#!/usr/bin/env python3
"""Pre-compute dense embeddings for the M8 coach corpus.

Embeds the EN and UR knowledge-base entries (content + keywords, the same
indexed text the sparse rankers see) with a multilingual sentence encoder and
persists them to backend/app/modules/m8_coach/data/corpus_embeddings.npz so
serving never recomputes them — only the query is embedded at request time.

Run from the repo root:
    PATH=~/.venvs/gtvenv/bin:$PATH python backend/scripts/build_corpus_embeddings.py

Re-running is safe: it just overwrites the npz.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "backend"))

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
OUT = ROOT / "backend" / "app" / "modules" / "m8_coach" / "data" / "corpus_embeddings.npz"


def main() -> None:
    from sentence_transformers import SentenceTransformer

    from app.modules.m8_coach.rag_service import (
        KNOWLEDGE_BASE_EN,
        KNOWLEDGE_BASE_UR,
        _indexed_text,
    )

    model = SentenceTransformer(MODEL_NAME)
    dim = model.get_embedding_dimension()

    en_texts = [_indexed_text(e) for e in KNOWLEDGE_BASE_EN]
    ur_texts = [_indexed_text(e) for e in KNOWLEDGE_BASE_UR]
    print(f"embedding {len(en_texts)} EN + {len(ur_texts)} UR docs with {MODEL_NAME} ...")
    en_emb = model.encode(en_texts, normalize_embeddings=True, show_progress_bar=False)
    ur_emb = model.encode(ur_texts, normalize_embeddings=True, show_progress_bar=False)
    print(f"shapes: en {en_emb.shape}, ur {ur_emb.shape}, dim {dim}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    import numpy as np

    np.savez_compressed(
        OUT,
        en=en_emb.astype("float32"),
        ur=ur_emb.astype("float32"),
        model=np.array(MODEL_NAME),
        dim=np.array(dim, dtype=np.int64),
    )
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
