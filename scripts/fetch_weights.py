#!/usr/bin/env python3
"""Fetch the M5 vision-model weights that are intentionally kept out of git.

Downloads into backend/weights/ (the layout vision_probe.py expects):
  FastSAM-s.pt                         (~23 MB, Ultralytics assets)
  depth-anything-v2-small-hf/          (~95 MB, Hugging Face snapshot)
  clip-vit-base-patch32/               (~350 MB, Hugging Face snapshot; M5 dish suggestion)

Stdlib only — no pip install needed. Run from the repo root:
    python scripts/fetch_weights.py

Re-running is safe: files that already exist with a plausible size are skipped.
Sources (same ones used for the WS2 vision probe):
  https://github.com/ultralytics/assets/releases/download/v8.4.0/FastSAM-s.pt
  https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf
"""
from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEIGHTS = ROOT / "backend" / "weights"

FASTSAM_URL = os.environ.get(
    "FASTSAM_URL",
    "https://github.com/ultralytics/assets/releases/download/v8.4.0/FastSAM-s.pt",
)
DEPTH_REPO = os.environ.get(
    "DEPTH_REPO", "https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf"
)
DEPTH_FILES = ("config.json", "preprocessor_config.json", "model.safetensors", "README.md")

CLIP_REPO = os.environ.get(
    "CLIP_REPO", "https://huggingface.co/openai/clip-vit-base-patch32"
)
CLIP_FILES = (
    "config.json",
    "preprocessor_config.json",
    "pytorch_model.bin",
    "tokenizer.json",
    "tokenizer_config.json",
    "merges.txt",
    "vocab.json",
    "special_tokens_map.json",
)
CLIP_MIN_SIZES = {"clip-vit-base-patch32/pytorch_model.bin": 600_000_000}

# Sanity sizes (bytes); anything smaller is treated as a truncated download.
MIN_SIZES = {
    "FastSAM-s.pt": 20_000_000,
    "depth-anything-v2-small-hf/model.safetensors": 90_000_000,
}


def _ok(path: Path, min_size: int) -> bool:
    return path.exists() and path.stat().st_size >= min_size


def _download(url: str, dest: Path, min_size: int = 0) -> None:
    if _ok(dest, min_size):
        print(f"  skip  {dest.relative_to(ROOT)} (already present)")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")

    def _progress(blocks: int, block_size: int, total: int) -> None:
        done = blocks * block_size
        pct = f"{100 * done / total:5.1f}%" if total and total > 0 else f"{done / 1e6:.1f} MB"
        print(f"\r  {dest.name}: {pct}", end="", flush=True)

    print(f"  fetch {url}")
    try:
        urllib.request.urlretrieve(url, tmp, reporthook=_progress)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError) as e:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"{dest.name}: download failed: {e}") from e
    print()
    if not _ok(tmp, min_size):
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"{dest.name}: download too small, deleted partial file")
    tmp.replace(dest)
    size_mb = dest.stat().st_size / 1e6
    size_str = f"{size_mb:.1f} MB" if size_mb >= 0.05 else f"{dest.stat().st_size} bytes"
    print(f"  saved {dest.relative_to(ROOT)} ({size_str})")


def main() -> int:
    print("GlycoTwin weight fetch ->", WEIGHTS.relative_to(ROOT))
    try:
        _download(FASTSAM_URL, WEIGHTS / "FastSAM-s.pt", MIN_SIZES["FastSAM-s.pt"])
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError) as e:
        print(f"  warn  FastSAM-s.pt: {e}")
        return 1
    depth_dir = WEIGHTS / "depth-anything-v2-small-hf"
    for name in DEPTH_FILES:
        url = f"{DEPTH_REPO}/resolve/main/{name}"
        min_size = MIN_SIZES.get(f"depth-anything-v2-small-hf/{name}", 0)
        try:
            _download(url, depth_dir / name, min_size)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError) as e:
            # README.md may be absent in some revisions; the rest are required.
            print(f"  warn  {name}: {e}")
            if name != "README.md":
                return 1
    clip_dir = WEIGHTS / "clip-vit-base-patch32"
    for name in CLIP_FILES:
        url = f"{CLIP_REPO}/resolve/main/{name}"
        min_size = CLIP_MIN_SIZES.get(f"clip-vit-base-patch32/{name}", 0)
        try:
            _download(url, clip_dir / name, min_size)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError) as e:
            print(f"  warn  {name}: {e}")
            return 1
    print("done.")
    _prefetch_sentence_encoder()
    return 0


def _prefetch_sentence_encoder() -> None:
    """Pre-download the M8 dense-retrieval encoder (~470MB) into the HF cache.

    Serving lazy-loads it on first retrieval; prefetching here warms the
    cache for offline deploys. Skipped gracefully when sentence-transformers
    is not installed.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("  skip  sentence encoder (sentence-transformers not installed)")
        return
    # Must match DENSE_MODEL_NAME in backend/app/modules/m8_coach/vector_store.py
    model_name = "paraphrase-multilingual-MiniLM-L12-v2"
    print(f"  fetch sentence encoder {model_name} (~470MB)")
    try:
        SentenceTransformer(model_name)
        print("  saved sentence encoder to the Hugging Face cache")
    except Exception as e:
        print(f"  warn  sentence encoder prefetch failed: {e}")


if __name__ == "__main__":
    sys.exit(main())
