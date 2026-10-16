"""M8 retrieval eval — dense + BM25 hybrid, with a held-out discipline.

The mentor's review noted the index was tuned on the same 36 questions it was
tested on. This module now splits the bank deterministically:

  tune set   : every question EXCEPT indices i % 3 == 2  (EN 19, UR 6)
  held-out   : indices i % 3 == 2                         (EN 9,  UR 2)

Retrieval is a multilingual dense (paraphrase-multilingual-MiniLM-L12-v2)
cosine blended with BM25. The dense/BM25 blend weight is tuned ONLY on the
tune set (test_tune_picks_dense_weight); the sparse BM25/TF-IDF weight is
tuned the same way for the Roman-Urdu fallback path. The held-out tests
below report the honest number and ratchet just under it — they fail on
regression.

Measured (2026-10-11, DENSE_WEIGHT=1.0, BM25_WEIGHT=0.5 sparse fallback):
  tune     EN 19/19 = 1.000    UR 5/6 = 0.833
  held-out EN 9/9  = 1.000    UR 2/2 = 1.000
  roman    6/6 = 1.000 (routed to the sparse path: the encoder is weak on
             Latin transliterations, measured 4/6 dense vs 6/6 sparse)

Roman Urdu queries ("khane ke baad walk faida deti hai?") arrive as
language="en" (Latin script). They are detected by Roman-Urdu markers,
expanded with English + Urdu-script synonyms, and scored by the sparse
hybrid (see vector_store.py).
"""

import numpy as np

from app.modules.m8_coach.rag_service import (
    BM25_WEIGHT,
    DENSE_WEIGHT,
    KNOWLEDGE_BASE_EN,
    KNOWLEDGE_BASE_UR,
    _indexed_text,
    retrieve_context_detailed,
)
from app.modules.m8_coach.vector_store import LocalVectorStore

QUESTIONS_EN = [
    ("Why does my sugar spike an hour after eating rice?", "postprandial"),
    ("Does a walk after dinner really help?", "walking"),
    ("How does fiber change my glucose curve?", "fiber"),
    ("What is glycemic index in simple words?", "glycemic_index"),
    ("How do I count carbs in a meal?", "carb_counting"),
    ("What should a balanced plate look like?", "plate_method"),
    ("Why does pizza raise my sugar again after three hours?", "protein_fat"),
    ("How much rice is one portion?", "portions"),
    ("I slept badly and my readings are worse today, why?", "sleep"),
    ("Can stress raise blood sugar without food?", "stress"),
    ("What are the signs of low blood sugar?", "hypo_awareness"),
    ("My sugar stays very high and I feel thirsty all the time", "hyper_awareness"),
    ("What does time in range mean?", "time_in_range"),
    ("What does the HbA1c test show?", "hba1c"),
    ("I want to fast in Ramadan, what should I think about?", "ramadan"),
    ("How do I read a nutrition label for sugar?", "labels"),
    ("Is fruit juice okay with meals?", "drinks"),
    ("Should I switch to brown rice and whole wheat roti?", "whole_grains"),
    ("Why is my fasting sugar high even though I ate little?", "dawn_phenomenon"),
    ("Is cycling or weight training better for sugar?", "exercise_types"),
    ("I sit at a desk all day, does that affect glucose?", "sitting"),
    ("Does drinking alcohol affect blood sugar later?", "alcohol"),
    ("Why does my sugar go up when I have a fever?", "sick_days"),
    ("How do I take care of my feet with diabetes?", "foot_care"),
    ("How can I find patterns in my own readings?", "logging"),
    ("Does drinking water change glucose readings?", "hydration"),
    ("Does eating salad before rice help?", "meal_timing"),
    ("What is a gentle breakfast for blood sugar?", "breakfast"),
]

QUESTIONS_UR = [
    ("کھانے کے بعد میری شوگر کیوں بڑھ جاتی ہے؟", "postprandial"),
    ("کھانے کے بعد واک فائدہ دیتی ہے؟", "walking"),
    ("فائبر شوگر کو کیسے کم کرتا ہے؟", "fiber"),
    ("سفید چاول شوگر تیزی سے کیوں بڑھاتا ہے؟", "glycemic_index"),
    ("پلیٹ میں کھانا کیسا ہونا چاہیے؟", "plate_method"),
    ("رمضان میں روزہ رکھنے کے لیے کیا سوچنا چاہیے؟", "ramadan"),
    ("صبح خالی پیٹ شوگر کیوں زیادہ ہوتی ہے؟", "dawn_phenomenon"),
    ("ایچ بی اے ون سی کیا بتاتا ہے؟", "hba1c"),
]

# Roman Urdu (Latin script, language="en"): natural phrasings a Roman-Urdu
# speaker would type. Scored through the EN store after marker detection +
# synonym expansion in vector_store.py.
QUESTIONS_ROMAN = [
    ("khane ke baad meri sugar kyun barh jati hai?", "postprandial"),
    ("khane ke baad walk karna faida deta hai?", "walking"),
    ("brown roti safed chawal se behtar kyun hai?", "whole_grains"),
    ("roza rakhna hai ramzan mein, kya khayal rakhun?", "ramadan"),
    ("subah khali pait sugar zyada kyun hoti hai?", "dawn_phenomenon"),
    ("raat ko neend poori na ho to sugar par kya asar hota hai?", "sleep"),
]


def _split(questions):
    """Deterministic tune/held-out split: every 3rd question is held out."""
    tune = [q for i, q in enumerate(questions) if i % 3 != 2]
    held = [q for i, q in enumerate(questions) if i % 3 == 2]
    return tune, held


TUNE_EN, HELDOUT_EN = _split(QUESTIONS_EN)
TUNE_UR, HELDOUT_UR = _split(QUESTIONS_UR)


def _hit_rate(questions, language):
    hits = 0
    misses = []
    for q, expected in questions:
        _, _, topics = retrieve_context_detailed(q, language)
        if expected in topics:
            hits += 1
        else:
            misses.append((q, expected, topics))
    return hits / len(questions), misses


def _store_for(language, bm25_weight, dense_weight=0.0):
    kb = KNOWLEDGE_BASE_EN if language == "en" else KNOWLEDGE_BASE_UR
    store = LocalVectorStore(language=language, bm25_weight=bm25_weight,
                             dense_weight=dense_weight)
    store.add_documents([_indexed_text(i) for i in kb],
                        [i["source"] for i in kb],
                        [i["topic"] for i in kb])
    return store


def _tune_hit_rate(bm25_weight, questions, language):
    store = _store_for(language, bm25_weight)
    hits = 0
    for q, expected in questions:
        if expected in store.search_with_topics(q, top_k=2)[2]:
            hits += 1
    return hits / len(questions)


def _dense_tune_hit_rate(dense_weight, questions, language):
    store = _store_for(language, 0.5, dense_weight=dense_weight)
    hits = 0
    for q, expected in questions:
        if expected in store.search_with_topics(q, top_k=2)[2]:
            hits += 1
    return hits / len(questions)


def test_tune_picks_production_weight():
    """Grid-search the blend weight on the TUNE set only.

    The production constant BM25_WEIGHT must equal the tune winner, so the
    served ranker is exactly what was tuned. Tie-break: prefer 0.5 (equal
    blend), then the smaller weight.
    """
    grid = [0.0, 0.25, 0.5, 0.75, 1.0]
    scored = []
    for w in grid:
        en = _tune_hit_rate(w, TUNE_EN, "en")
        ur = _tune_hit_rate(w, TUNE_UR, "ur")
        scored.append((en + ur, w))
    best = max(scored, key=lambda t: (round(t[0], 9),
                                      -abs(t[1] - 0.5), -t[1]))[1]
    print(f"\ntune grid: {[(w, round(s, 3)) for s, w in scored]} -> best {best}")
    assert best == BM25_WEIGHT, (
        f"tune winner {best} != production BM25_WEIGHT {BM25_WEIGHT}: "
        "re-tune and update the constant, or the served ranker differs "
        "from what was evaluated")


def test_tune_picks_dense_weight():
    """Grid-search the dense/BM25 blend weight on the TUNE set only.

    Production constant DENSE_WEIGHT must equal the tune winner, so the
    served ranker is exactly what was tuned. Tie-break: prefer 1.0 (pure
    dense), then the larger weight — the dense signal won outright here.
    """
    grid = [0.0, 0.25, 0.5, 0.75, 1.0]
    scored = []
    for w in grid:
        en = _dense_tune_hit_rate(w, TUNE_EN, "en")
        ur = _dense_tune_hit_rate(w, TUNE_UR, "ur")
        scored.append((en + ur, w))
    best = max(scored, key=lambda t: (round(t[0], 9), t[1]))[1]
    print(f"\ndense tune grid: {[(w, round(s, 3)) for s, w in scored]} -> best {best}")
    assert best == DENSE_WEIGHT, (
        f"tune winner {best} != production DENSE_WEIGHT {DENSE_WEIGHT}: "
        "re-tune and update the constant, or the served ranker differs "
        "from what was evaluated")


def test_tune_set_regression():
    rate_en, misses_en = _hit_rate(TUNE_EN, "en")
    rate_ur, misses_ur = _hit_rate(TUNE_UR, "ur")
    print(f"\ntune EN {rate_en:.3f} misses={misses_en}")
    print(f"tune UR {rate_ur:.3f} misses={misses_ur}")
    assert rate_en >= 0.95  # measured 1.000 (19/19) with dense
    assert rate_ur >= 0.80  # measured 0.833 (5/6)


def test_heldout_english():
    rate, misses = _hit_rate(HELDOUT_EN, "en")
    print(f"\nHELD-OUT EN {rate:.3f} ({len(HELDOUT_EN)} questions) misses={misses}")
    assert rate >= 0.90  # measured 1.000 (9/9); ratchet, not aspiration


def test_heldout_urdu():
    rate, misses = _hit_rate(HELDOUT_UR, "ur")
    print(f"\nHELD-OUT UR {rate:.3f} ({len(HELDOUT_UR)} questions) misses={misses}")
    assert rate >= 1.0  # measured 1.000 (2/2); tiny set, documented


def test_roman_urdu_retrieval():
    rate, misses = _hit_rate(QUESTIONS_ROMAN, "en")
    print(f"\nRoman Urdu {rate:.3f} misses={misses}")
    assert rate >= 0.80  # measured 1.000 (6/6) via the sparse fallback path


def test_dense_embedding_determinism():
    """Same query embedded twice gives identical scores (no randomness)."""
    store = _store_for("en", 0.5, dense_weight=1.0)
    q = "Why does my sugar spike an hour after eating rice?"
    s1 = store._hybrid_scores(q)
    s2 = store._hybrid_scores(q)
    np.testing.assert_array_equal(s1, s2)


def test_dense_relevance_gate_blocks_unrelated():
    """Unrelated queries return nothing: the raw-cosine gate (0.30) must hold.

    Without the gate, per-query min-max normalization promotes the best of
    an irrelevant set to 1.0 and unrelated questions leak answers.
    """
    store = _store_for("en", 0.5, dense_weight=1.0)
    for q in ["capital of France", "quantum chromodynamics",
              "best cricket batsman"]:
        snippets, _ = store.search(q, top_k=2)
        assert snippets == [], f"leaked answer for {q!r}: {snippets[:1]}"


def test_corpus_is_sourced_and_bilingual():
    assert len(KNOWLEDGE_BASE_EN) >= 25
    assert len(KNOWLEDGE_BASE_UR) >= 12
    for entry in KNOWLEDGE_BASE_EN + KNOWLEDGE_BASE_UR:
        assert entry["source"] and entry["topic"] and entry["content"]
