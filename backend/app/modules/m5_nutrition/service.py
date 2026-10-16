"""M5 service layer: owns the catalog and vision models as process singletons.

The original GlycoTwin code reloaded FastSAM/Depth weights on every request;
here the model factories are cached so weights load exactly once per process.
If the weights are absent, the pipeline runs in fixture vision mode (same
stage code, deterministic stand-in perception) and says so in every response.
"""
from __future__ import annotations

import threading
from functools import lru_cache
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.modules.m5_nutrition.catalog import NutritionCatalog, load_catalog
from app.modules.m5_nutrition.depth import _load_depth_model
from app.modules.m5_nutrition.pipeline import (
    MealNutritionPipeline,
    fixture_depth_factory,
    fixture_fastsam_factory,
)
from app.modules.m5_nutrition.segmentation import _load_fastsam_model

log = get_logger("glycotwin.m5.service")

# RLock, not Lock: get_pipeline() builds the pipeline (acquiring the lock)
# and itself calls get_catalog(), which also guards its singleton with it.
# A plain Lock deadlocked the very first /estimate request on a cold server
# (found by the Phase 4 clean-clone proof; tests had warmed the catalog
# first, which masked it).
_lock = threading.RLock()
_catalog: NutritionCatalog | None = None
_pipeline: MealNutritionPipeline | None = None


def _resolve_weight_path(p: Path | str) -> Path:
    path = Path(p)
    if path.is_absolute():
        return path
    if path.exists():
        return path
    backend_root = Path(__file__).resolve().parents[3]
    candidate = backend_root / path
    if candidate.exists():
        return candidate
    return candidate


def _settings_ns() -> SimpleNamespace:
    s = get_settings()
    return SimpleNamespace(
        fastsam_model_path=_resolve_weight_path(s.fastsam_model_path),
        depth_anything_model_path=_resolve_weight_path(s.depth_anything_model_path),
        clip_model_path=_resolve_weight_path(getattr(s, "clip_model_path", "weights/clip-vit-base-patch32")),
        depth_model_device=s.depth_model_device,
    )


def get_catalog() -> NutritionCatalog:
    global _catalog
    if _catalog is None:
        with _lock:
            if _catalog is None:
                data_dir = Path(__file__).parent / "data"
                curated = data_dir / "dish_catalog_v1.json"
                data = curated if curated.exists() else data_dir / "dish_catalog_fixture.json"
                _catalog = load_catalog(data)
                log.info("M5 catalog loaded: %s (status=%s, %d taxa)",
                         _catalog.data_version, _catalog.status,
                         len(_catalog.taxonomy))
    return _catalog


@lru_cache(maxsize=1)
def _fastsam_once(path: Path) -> Any:
    log.info("Loading FastSAM weights once from %s", path)
    return _load_fastsam_model(path)


@lru_cache(maxsize=1)
def _depth_once(path: Path, device: str) -> Any:
    log.info("Loading Depth Anything weights once from %s", path)
    return _load_depth_model(path, device)


def verify_vision_weights() -> tuple[bool, dict[str, Any], list[str]]:
    """Verify presence and minimum plausibility sizes of M5 vision weights.

    Checks:
      - FastSAM-s.pt (>= 20MB)
      - depth-anything-v2-small-hf/model.safetensors (>= 90MB)
      - clip-vit-base-patch32/pytorch_model.bin (>= 300MB)

    Returns:
      (is_healthy, details, degraded_reasons)
    """
    ns = _settings_ns()
    details: dict[str, Any] = {}
    degraded_reasons: list[str] = []

    # 1. FastSAM-s.pt (>= 20 MB)
    fastsam_path = ns.fastsam_model_path
    fastsam_file = fastsam_path if not fastsam_path.is_dir() else fastsam_path / "FastSAM-s.pt"
    if not fastsam_file.exists():
        degraded_reasons.append(f"FastSAM weights missing at {fastsam_file}")
        details["fastsam"] = {"status": "missing", "path": str(fastsam_file)}
    else:
        try:
            fastsam_size = fastsam_file.stat().st_size
        except (OSError, PermissionError) as e:
            degraded_reasons.append(f"FastSAM weights unreadable at {fastsam_file}: {e}")
            details["fastsam"] = {"status": "unreadable", "path": str(fastsam_file), "error": str(e)}
        else:
            if fastsam_size < 20_000_000:
                degraded_reasons.append(
                    f"FastSAM weights truncated at {fastsam_file} ({fastsam_size} bytes < 20MB)"
                )
                details["fastsam"] = {
                    "status": "truncated",
                    "path": str(fastsam_file),
                    "size_bytes": fastsam_size,
                }
            else:
                details["fastsam"] = {
                    "status": "ok",
                    "path": str(fastsam_file),
                    "size_bytes": fastsam_size,
                }

    # 2. Depth Anything v2 (>= 90 MB)
    depth_path = ns.depth_anything_model_path
    depth_file = depth_path / "model.safetensors" if depth_path.is_dir() or not depth_path.name.endswith(".safetensors") else depth_path
    if not depth_file.exists():
        degraded_reasons.append(f"Depth Anything v2 weights missing at {depth_file}")
        details["depth_anything"] = {"status": "missing", "path": str(depth_file)}
    else:
        try:
            depth_size = depth_file.stat().st_size
        except (OSError, PermissionError) as e:
            degraded_reasons.append(f"Depth Anything v2 weights unreadable at {depth_file}: {e}")
            details["depth_anything"] = {"status": "unreadable", "path": str(depth_file), "error": str(e)}
        else:
            if depth_size < 90_000_000:
                degraded_reasons.append(
                    f"Depth Anything v2 weights truncated at {depth_file} ({depth_size} bytes < 90MB)"
                )
                details["depth_anything"] = {
                    "status": "truncated",
                    "path": str(depth_file),
                    "size_bytes": depth_size,
                }
            else:
                details["depth_anything"] = {
                    "status": "ok",
                    "path": str(depth_file),
                    "size_bytes": depth_size,
                }

    # 3. CLIP (>= 300 MB)
    clip_path = ns.clip_model_path
    clip_file = clip_path / "pytorch_model.bin" if clip_path.is_dir() or not clip_path.name.endswith(".bin") else clip_path
    if not clip_file.exists():
        degraded_reasons.append(f"CLIP weights missing at {clip_file}")
        details["clip"] = {"status": "missing", "path": str(clip_file)}
    else:
        try:
            clip_size = clip_file.stat().st_size
        except (OSError, PermissionError) as e:
            degraded_reasons.append(f"CLIP weights unreadable at {clip_file}: {e}")
            details["clip"] = {"status": "unreadable", "path": str(clip_file), "error": str(e)}
        else:
            if clip_size < 300_000_000:
                degraded_reasons.append(
                    f"CLIP weights truncated at {clip_file} ({clip_size} bytes < 300MB)"
                )
                details["clip"] = {
                    "status": "truncated",
                    "path": str(clip_file),
                    "size_bytes": clip_size,
                }
            else:
                details["clip"] = {
                    "status": "ok",
                    "path": str(clip_file),
                    "size_bytes": clip_size,
                }

    is_healthy = len(degraded_reasons) == 0
    return is_healthy, details, degraded_reasons


def vision_mode() -> str:
    is_healthy, _, _ = verify_vision_weights()
    return "models" if is_healthy else "fixture"


def get_pipeline() -> MealNutritionPipeline:
    global _pipeline
    if _pipeline is None:
        with _lock:
            if _pipeline is None:
                mode = vision_mode()
                if mode == "models":
                    fastsam_factory = _fastsam_once
                    depth_factory = _depth_once
                else:
                    fastsam_factory = fixture_fastsam_factory
                    depth_factory = fixture_depth_factory
                _pipeline = MealNutritionPipeline(
                    get_catalog(), _settings_ns(), vision_mode=mode,
                    fastsam_factory=fastsam_factory, depth_factory=depth_factory,
                )
                log.info("M5 pipeline ready (vision_mode=%s)", mode)
    return _pipeline


def run_estimate(image_bytes: bytes, content_type: str | None, **kwargs: Any) -> dict[str, Any]:
    return get_pipeline().run(image_bytes, content_type, **kwargs)


def list_dishes() -> list[dict[str, Any]]:
    catalog = get_catalog()
    return [
        {
            "food_id": taxon.food_id,
            "english": taxon.english_name,
            "urdu": taxon.urdu_name,
            "roman_urdu": taxon.roman_urdu_name,
            "has_nutrition_profile": catalog.get(taxon.food_id) is not None,
        }
        for taxon in sorted(catalog.taxonomy.values(), key=lambda t: t.english_name)
    ]
