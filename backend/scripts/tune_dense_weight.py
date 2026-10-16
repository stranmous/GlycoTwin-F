"""Tune the dense/BM25 blend weight on the TUNE set only, then report held-out.

Mirrors the protocol in backend/tests/test_m8_retrieval.py exactly:
  tune set   : every question EXCEPT indices i % 3 == 2
  held-out   : indices i % 3 == 2

Run from backend/:
    PATH=~/.venvs/gtvenv/bin:$PATH python scripts/tune_dense_weight.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.modules.m8_coach.rag_service import (
    KNOWLEDGE_BASE_EN,
    KNOWLEDGE_BASE_UR,
    _indexed_text,
)
from app.modules.m8_coach.vector_store import LocalVectorStore
from tests.test_m8_retrieval import (
    HELDOUT_EN,
    HELDOUT_UR,
    QUESTIONS_ROMAN,
    TUNE_EN,
    TUNE_UR,
)


def _store(language, dense_weight):
    kb = KNOWLEDGE_BASE_EN if language == "en" else KNOWLEDGE_BASE_UR
    store = LocalVectorStore(language=language, bm25_weight=0.5,
                             dense_weight=dense_weight)
    store.add_documents([_indexed_text(i) for i in kb],
                        [i["source"] for i in kb],
                        [i["topic"] for i in kb])
    return store


def _hit_rate(store, questions, language):
    hits = 0
    misses = []
    for q, expected in questions:
        topics = store.search_with_topics(q, top_k=2)[2]
        if expected in topics:
            hits += 1
        else:
            misses.append((q, expected, topics))
    return hits / len(questions), misses


def main():
    grid = [0.0, 0.25, 0.5, 0.75, 1.0]
    print("=== TUNE (dense_weight grid) ===")
    tune_rows = []
    for w in grid:
        st_en = _store("en", w)
        st_ur = _store("ur", w)
        en, _ = _hit_rate(st_en, TUNE_EN, "en")
        ur, _ = _hit_rate(st_ur, TUNE_UR, "ur")
        print(f"  dense_weight={w:.2f}  tune EN {en:.3f}  UR {ur:.3f}  avg {(en + ur) / 2:.3f}")
        tune_rows.append((w, en, ur))
    # winner: best avg, tie-break prefer 0.5 then smaller
    best = max(tune_rows, key=lambda r: (round((r[1] + r[2]) / 2, 9),
                                        -abs(r[0] - 0.5), -r[0]))
    w_star = best[0]
    print(f"TUNE WINNER: dense_weight={w_star}")

    print("=== HELD-OUT (winner) vs sparse baseline ===")
    for w, label in [(w_star, "dense+BM25"), (0.0, "sparse BM25+TFIDF")]:
        st_en = _store("en", w)
        st_ur = _store("ur", w)
        en, en_miss = _hit_rate(st_en, HELDOUT_EN, "en")
        ur, ur_miss = _hit_rate(st_ur, HELDOUT_UR, "ur")
        ro, ro_miss = _hit_rate(st_en, QUESTIONS_ROMAN, "en")
        print(f"  {label}: held-out EN {en:.3f} ({int(en*9)}/9)  "
              f"UR {ur:.3f} ({int(ur*2)}/2)  roman {ro:.3f} ({int(ro*6)}/6)")
        for q, exp, got in en_miss + ur_miss + ro_miss:
            print(f"    MISS [{exp}] {q[:60]} -> {got}")

    # no-guidance sanity: unrelated queries must return nothing
    st_en = _store("en", w_star)
    for q in ["capital of France", "quantum chromodynamics", "best cricket batsman"]:
        snips, _ = st_en.search(q, top_k=2)
        print(f"  no-guidance {q!r}: {'EMPTY ok' if not snips else 'LEAKED: ' + str(snips)[:60]}")


if __name__ == "__main__":
    main()
