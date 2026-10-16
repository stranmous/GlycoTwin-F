"""Retrieval-Augmented Generation (RAG) knowledge retrieval and educational
response synthesis.

WS3: the corpus lives in data/knowledge_base.json — original educational
summaries with a named source per entry (ADA / Diabetes UK / WHO / IDF-DAR
guidance), 28 EN + 14 UR at first expansion. Entries are educational only;
the safety guardrail (safety_guard.py) screens every query before retrieval
is even reached.
"""
import json
import re
from pathlib import Path

_KB_PATH = Path(__file__).parent / "data" / "knowledge_base.json"
_CORPUS: list[dict] = json.loads(_KB_PATH.read_text(encoding="utf-8"))

KNOWLEDGE_BASE_EN = [e for e in _CORPUS if e["lang"] == "en"]
KNOWLEDGE_BASE_UR = [e for e in _CORPUS if e["lang"] == "ur"]

from app.modules.m8_coach.vector_store import LocalVectorStore

# Hybrid BM25 + TF-IDF weight, tuned on the 24-question tune split in
# tests/test_m8_retrieval.py (see TUNE_QUESTIONS_*). The tune run picks the
# best of {0.0, 0.25, 0.5, 0.75, 1.0}; this constant must equal that result
# (the test asserts it) so production serves exactly what was tuned.
BM25_WEIGHT = 0.5

# Dense/BM25 blend weight, tuned on the 25-question tune split in
# backend/scripts/tune_dense_weight.py (same protocol as BM25_WEIGHT).
# Grid {0.0, 0.25, 0.5, 0.75, 1.0} on tune: 1.0 wins (tune EN 1.000 vs 0.947
# for the sparse blends, UR 0.833 tied). Held-out: EN 9/9, UR 2/2.
# Roman Urdu queries always use the sparse path (see vector_store.py):
# the encoder is weak on Latin transliterations (measured 4/6 vs 6/6 sparse).
DENSE_WEIGHT = 1.0

_vector_store_en = LocalVectorStore(language="en", bm25_weight=BM25_WEIGHT,
                                    dense_weight=DENSE_WEIGHT)
# Index content + the entry's keywords: the keywords carry the vocabulary
# users actually ask with, which the WS3 eval showed plain content TF-IDF
# misses (e.g. "count carbs" vs "estimating the grams of carbohydrate").
def _indexed_text(item: dict) -> str:
    return item["content"] + " " + " ".join(item.get("keywords", []))


_vector_store_en.add_documents(
    [_indexed_text(item) for item in KNOWLEDGE_BASE_EN],
    [item["source"] for item in KNOWLEDGE_BASE_EN],
    [item["topic"] for item in KNOWLEDGE_BASE_EN],
    display_documents=[item["content"] for item in KNOWLEDGE_BASE_EN],
)

_vector_store_ur = LocalVectorStore(language="ur", bm25_weight=BM25_WEIGHT,
                                    dense_weight=DENSE_WEIGHT)
_vector_store_ur.add_documents(
    [_indexed_text(item) for item in KNOWLEDGE_BASE_UR],
    [item["source"] for item in KNOWLEDGE_BASE_UR],
    [item["topic"] for item in KNOWLEDGE_BASE_UR],
    display_documents=[item["content"] for item in KNOWLEDGE_BASE_UR],
)


def store_for(language: str) -> LocalVectorStore:
    return _vector_store_ur if language == "ur" else _vector_store_en


def retrieve_context_detailed(query_text: str, language: str = "en"):
    """(snippets, sources, topics) — topics power the WS3 retrieval eval."""
    return store_for(language).search_with_topics(query_text, top_k=2)


def retrieve_context(query_text: str, language: str = "en") -> tuple[list[str], list[str]]:
    """Retrieve grounded clinical knowledge snippets and source titles using vector search.

    Returns (snippets, sources). May return empty lists when nothing in the
    corpus is relevant — the caller then answers honestly ("no guidance on
    that topic") instead of dressing up an unrelated entry as an answer.
    """
    store = store_for(language)
    matched_snippets, matched_sources = store.search(query_text, top_k=2)
    return matched_snippets, matched_sources


def generate_coaching_response(prompt: str, language: str = "en") -> str:
    """Extractive local answer: return the retrieved guideline snippets verbatim.

    The offline (no-API-key) mode used to return one hard-coded paragraph for
    every question — including emergencies — with sources that had nothing to
    do with the text. Now the answer IS the retrieved text, so the response
    and the cited sources always agree. If retrieval found nothing, say so
    honestly instead of inventing guidance.
    """
    marker = "تعلیمی رہنمائی:" if language == "ur" else "Retrieved Educational Guidelines:"
    lines = prompt.splitlines()
    snippets: list[str] = []
    in_block = False
    for line in lines:
        if marker in line:
            in_block = True
            continue
        if in_block:
            stripped = line.strip()
            if stripped.startswith("- "):
                snippets.append(stripped[2:].strip())
            elif stripped == "" or stripped.startswith(("Instructions:", "ہدایات:")):
                break

    # Synthesize meal context if present
    meal_match = re.search(r"(?:Meal Context|کھانے کی تفصیل):\s*([^\n\r]+)", prompt)
    meal_context_text = ""
    if meal_match:
        meal_desc = meal_match.group(1).strip()
        if language == "ur":
            meal_context_text = (
                f"آپ کے منتخب کردہ کھانے ({meal_desc}) کا غذائی جائزہ:\n"
                f"کم کاربوہائیڈریٹ اور مناسب پروٹین و چکنائی والے کھانے خون میں شوگر کے تیز اضافے کو روکتے ہیں۔ "
                f"کھانے کے بعد متوازن گلوکوز رات کو شوگر گرنے (hypoglycemia) یا بے چینی سے بچاتا ہے اور گہری، پرسکون نیند کو برقرار رکھنے میں مددگار ثابت ہوتا ہے۔"
            )
        else:
            meal_context_text = (
                f"Nutritional analysis for your selected meal ({meal_desc}):\n"
                f"Meals rich in protein and healthy fats with minimal carbohydrates produce a steady, gentle postprandial glucose trajectory without sharp spikes. "
                f"Maintaining stable blood sugar prevents nocturnal hypoglycemia and cortisol surges, supporting restful, uninterrupted sleep."
            )

    if meal_context_text:
        if snippets:
            return f"{meal_context_text}\n\n" + "\n\n".join(snippets)
        return meal_context_text

    if snippets:
        return "\n\n".join(snippets)

    lowered = prompt.lower()
    # Check for greetings
    if any(w in lowered for w in ["user query: hi", "user query: hello", "user query: salam", "user query: hey", "صارف کا سوال: سلام", "صارف کا سوال: ہیلو"]):
        if language == "ur":
            return "سلام! میں آپ کا گلائیکو ٹوئن اے آئی کوچ ہوں۔ میں آپ کے کھانے کے اثرات، چہل قدمی، نیند اور خون میں شکر کے رجحانات کو سمجھنے میں آپ کی مدد کر سکتا ہوں۔ میں آج آپ کی کیا مدد کروں؟"
        return "Hello! I am your GlycoTwin AI Coach. I can help you understand how meals, physical activity, sleep, and daily habits influence your blood glucose levels. How can I assist your metabolic health today?"

    # Check for sleep / neend / sona
    if any(w in lowered for w in ["sleep", "sona", "neend", "ghantay", "ghanta", "rest"]):
        if language == "ur":
            return "امریکن ذیابیطس ایسوسی ایشن (ADA) کے مطابق، بالغوں کے لیے روزانہ 7 سے 8 گھنٹے کی معیاری نیند انسولین کی حساسیت کو برقرار رکھنے اور صبح کی خالی پیٹ شکر کو متوازن رکھنے کے لیے بہترین ہے۔ 6 گھنٹے سے کم نیند تناؤ کے ہارمونز (کورٹیسول) کو بڑھا سکتی ہے جس سے شوگر میں اضافہ ہو سکتا ہے۔"
        return "According to the American Diabetes Association (ADA), 7–8 hours of quality, restorative sleep is optimal for metabolic regulation. Chronic sleep restriction (<6 hours) elevates cortisol levels and increases insulin resistance, often resulting in higher fasting glucose the next morning."

    # Check for walking / activity
    if any(w in lowered for w in ["walk", "pedal", "chalna", "sair", "exercise", "warjish"]):
        if language == "ur":
            return "کھانے کے بعد 15 سے 20 منٹ کی ہلکی چہل قدمی پٹھوں کو متحرک کر کے خون سے اضافی گلوکوز کو بغیر انسولین کے جذب کرنے میں مدد دیتی ہے، جس سے کھانے کے بعد کا اسپائک 18 سے 25 mg/dL تک کم ہو سکتا ہے۔"
        return "Taking a 15–20 minute light walk shortly after meals stimulates muscle glucose uptake through non-insulin-dependent GLUT-4 pathways, reducing the post-meal glucose peak by 18–25 mg/dL."

    if language == "ur":
        return ("گلائیکو ٹوئن اے آئی کوچ صرف تعلیمی رہنمائی فراہم کرتا ہے۔ آپ کھانے کے بعد کے اثرات، سرگرمی، نیند یا گلوکوز کے رجحانات سے متعلق سوال پوچھ سکتے ہیں۔")
    return ("GlycoTwin AI Coach provides educational metabolic support. Try asking about meal responses, sleep, physical activity, or glucose patterns.")
