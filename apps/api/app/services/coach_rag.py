"""AI Coach: Gemini with three-tier guardrail pipeline.

Pipeline (no Gemini call until tier 3):
  Tier 1 — Hard safety: emergency / dosage / diagnosis → instant refusal
  Tier 2 — Off-topic guard: greetings pass; long off-topic messages → canned reply
  Tier 3 — Gemini call with assembled context + chat history
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Literal

from google import genai
from google.genai import types as genai_types

from app.core.config import get_settings
from app.schemas.coach import HiddenContext

SafetyCategory = Literal[
    "ok",
    "refused_dosage",
    "refused_diagnosis",
    "refused_emergency",
    "refused_offtopic",
]

# ── Tier 1: Hard safety regexes ───────────────────────────────────────────────
_DOSAGE_RE = re.compile(
    r"\b(insulin|units?|bolus|basal|metformin|sulfonylurea|glipizide|"
    r"dose|dosage|how much .{0,20} take)\b",
    re.IGNORECASE,
)
_DIAGNOSIS_RE = re.compile(
    r"\b(diagnos[ei]|do i have|am i (diabetic|prediabetic)|what.?s wrong with me)\b",
    re.IGNORECASE,
)
_EMERGENCY_RE = re.compile(
    r"\b(unconscious|seizure|chest pain|can.?t breathe|emergency|911|ambulance)\b",
    re.IGNORECASE,
)

# ── Tier 2: Topic allowlist + greeting passthrough ────────────────────────────
_TOPIC_RE = re.compile(
    r"\b(glucose|sugar|carb|meal|food|eat|diet|diabetes|diabetic|blood|spike|"
    r"a1c|hba1c|tir|range|coach|app|glycotwin|walk|exercise|weight|nutrition|"
    r"fast|portion|calor|protein|fat|reading|monitor|cgm|glyc|health|doctor|"
    r"clinic|level|high|low|target|trend|insight|simulat|insulin|medic)\b",
    re.IGNORECASE,
)
# Urdu: \b doesn't work on Arabic script — plain substring match instead.
_TOPIC_UR_RE = re.compile(
    r"(شوگر|ذیابیطس|خون|گلوکوز|انسولین|کاربوہائیڈریٹ|کھانا|کھانے|خوراک|"
    r"غذا|غذائی|غذائیت|ورزش|وزن|صحت|ڈاکٹر|دوا|شکر|اے ون سی|کوچ|ایپ|"
    r"بلڈ|چہل|رجحانات|اسپائک|نشانہ|رینج|سطح|ریڈنگ|ٹیسٹ|کلینک)"
)
_GREETING_RE = re.compile(
    r"^(hi|hello|hey|salam|assalam|thanks|thank|shukriya|thx|okay|ok|"
    r"yes|no|آداب|سلام|شکریہ|ہاں|نہیں).{0,40}$",
    re.IGNORECASE,
)

# ── Canned responses ──────────────────────────────────────────────────────────
_REFUSALS: dict[str, dict[str, str]] = {
    "refused_emergency": {
        "en": "Please contact your local emergency services immediately.",
        "ur": "براہ کرم فوراً مقامی ایمرجنسی نمبر پر کال کریں۔",
    },
    "refused_dosage": {
        "en": "I can't advise on medication doses. Please talk to your clinician.",
        "ur": "میں دواؤں کی مقدار تجویز نہیں کر سکتا۔ براہ کرم اپنے ڈاکٹر سے مشورہ کریں۔",
    },
    "refused_diagnosis": {
        "en": "I can't provide a diagnosis. A trained clinician should make that call.",
        "ur": "میں تشخیص نہیں دے سکتا۔ یہ ایک تربیت یافتہ ڈاکٹر کا کام ہے۔",
    },
    "refused_offtopic": {
        "en": "I am the GlycoTwin Coach. I can only help you with diabetes management and nutrition.",
        "ur": "میں GlycoTwin کوچ ہوں۔ میں صرف ذیابیطس اور غذائیت کے بارے میں مدد کر سکتا ہوں۔",
    },
}

_SYSTEM_PROMPT = (
    "You are the GlycoTwin AI Coach, a bilingual (English/Urdu) educational assistant "
    "for diabetes management. Reply in the language the user uses.\n\n"
    "TONE: You must speak at a 6th-grade reading level. Explain everything in layman's "
    "terms using simple, everyday analogies. Completely avoid complex medical jargon.\n\n"
    "FORMATTING: Whenever explaining data, spikes, or routines, use Markdown tables or "
    "simple visual scales (e.g., emojis or ASCII blocks like [████░░]) to make data "
    "highly visual and easy to understand.\n\n"
    "SCOPE: You will be provided with the user's question and a hidden context of their "
    "recent health data. Use this data to inform your educational answers. NEVER provide "
    "medical diagnoses or prescribe treatment; always remind the user to consult a doctor. "
    "Focus your answers strictly on diabetes management, nutrition, and the provided context. "
    "CRITICAL: The hidden context is provided for your awareness. Do NOT analyze or mention "
    "the user's meal or glucose data unless the user's question specifically asks about it "
    "or it is directly relevant. If the user just says hello or greets you, simply greet "
    "them back as the GlycoTwin Coach and ask how you can help them with their health."
)

_FOLLOW_UPS = {
    "en": ["What if I add a short walk?", "How do carbs affect my glucose?", "Show me my trends"],
    "ur": ["اگر میں چہل قدمی کروں تو؟", "کاربوہائیڈریٹ میری شکر کو کیسے متاثر کرتے ہیں؟", "میرے رجحانات دکھائیں"],
}


@dataclass
class CoachResult:
    text: str
    safety_category: SafetyCategory
    follow_ups: list[str] = field(default_factory=list)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify_safety(text: str) -> SafetyCategory | None:
    if _EMERGENCY_RE.search(text):
        return "refused_emergency"
    if _DOSAGE_RE.search(text):
        return "refused_dosage"
    if _DIAGNOSIS_RE.search(text):
        return "refused_diagnosis"
    return None


def _is_offtopic(text: str) -> bool:
    stripped = text.strip()
    if _GREETING_RE.match(stripped):
        return False
    return not (_TOPIC_RE.search(stripped) or _TOPIC_UR_RE.search(stripped))


def _build_context_block(ctx: HiddenContext | None) -> str:
    if not ctx:
        return ""
    parts: list[str] = []
    if ctx.last_meal_name:
        carbs = f" ({ctx.last_meal_carbs_g:.0f}g carbs)" if ctx.last_meal_carbs_g else ""
        parts.append(f"Last meal: {ctx.last_meal_name}{carbs}")
    if ctx.tir_percent is not None:
        parts.append(f"Time-in-Range today: {ctx.tir_percent:.0f}%")
    if ctx.latest_glucose_mgdl is not None:
        parts.append(f"Latest glucose: {ctx.latest_glucose_mgdl:.0f} mg/dL")
    if not parts:
        return ""
    return "Hidden context — " + "; ".join(parts) + "."


def _stub_reply(language: str) -> CoachResult:
    text = (
        "آپ کے کھانے کے بعد 15 منٹ کی چہل قدمی شکر میں اضافہ کم کر سکتی ہے۔"
        if language == "ur"
        else "A 15-minute walk after meals often blunts the post-meal glucose spike."
    )
    return CoachResult(
        text=f"(dev stub) {text}",
        safety_category="ok",
        follow_ups=_FOLLOW_UPS.get(language, _FOLLOW_UPS["en"]),
    )


# ── Main entry point ──────────────────────────────────────────────────────────

async def reply(
    *,
    user_text: str,
    language: str,
    hidden_context: HiddenContext | None = None,
    chat_history: list | None = None,
) -> CoachResult:
    lang = "ur" if language == "ur" else "en"
    history = chat_history or []

    # Tier 1 — hard safety (zero tokens spent)
    safety_cat = _classify_safety(user_text)
    if safety_cat is not None:
        return CoachResult(
            text=_REFUSALS[safety_cat][lang],
            safety_category=safety_cat,
            follow_ups=[],
        )

    # Tier 2 — off-topic guard (zero tokens spent)
    if _is_offtopic(user_text):
        return CoachResult(
            text=_REFUSALS["refused_offtopic"][lang],
            safety_category="refused_offtopic",
            follow_ups=[],
        )

    # Tier 3 — Gemini call
    settings = get_settings()
    if not settings.gemini_api_key:
        return _stub_reply(lang)

    context_block = _build_context_block(hidden_context)
    current_prompt = f"User Question: {user_text}"
    if context_block:
        current_prompt += f"\n\n{context_block}"

    # Build multi-turn contents: last 14 prior messages + current user turn
    contents: list[dict] = []
    for msg in history[-14:]:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.text}]})
    contents.append({"role": "user", "parts": [{"text": current_prompt}]})

    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=contents,
            config=genai_types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.2,
                max_output_tokens=2000,
            ),
        )
        text = (response.text or "").strip()
    except Exception:
        return _stub_reply(lang)

    return CoachResult(
        text=text,
        safety_category="ok",
        follow_ups=_FOLLOW_UPS.get(lang, _FOLLOW_UPS["en"]),
    )
