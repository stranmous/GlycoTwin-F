import re

DISCLAIMER_EN = (
    "Disclaimer: GlycoTwin AI Coach provides educational decision-support insights only "
    "and does not provide medical diagnosis, treatment, or insulin dosage recommendations. "
    "Please consult a qualified healthcare professional for medical advice."
)

DISCLAIMER_UR = (
    "تنبیہ: گلائیکو ٹوئن اے آئی کوچ صرف تعلیمی اور فیصلے کی معاونت کی معلومات فراہم کرتا ہے "
    "اور طبعی تشخیص، علاج، یا انسولین کی مقدار تجویز نہیں کرتا۔ طبی مشورے کے لیے براہ کرم کسی قابل معالج سے رجوع کریں۔"
)

# Unsafe query patterns (English & Urdu)
UNSAFE_PATTERNS_EN = [
    # Insulin dosage / units calculation
    r"\b(how\s+many|what)\s+units?\b.*\binsulin\b",
    r"\binsulin\b.*\b(dose|dosage|units?|calculate|take|amount|recommendation)\b",
    # verb BEFORE the drug ("should I take my insulin before this biryani?").
    # "use/using" deliberately excluded: "how does the body use insulin" is
    # educational and must not be refused.
    r"\b(take|taking|took|inject|injecting|shoot|shot)\b[^.]{0,40}\binsulin\b",
    r"\bunits?\b[^.]{0,40}\binject\b",
    r"\binject\b[^.]{0,40}\bunits?\b",
    r"\b(bolus|basal)\b.*\b(dose|units?|calculator?)\b",
    # bare "N units" dosage questions ("is 6 units ok before dinner")
    r"\b(is|are|ok|okay|enough|should)\b[^.]{0,60}\b\d+(\.\d+)?\s*units?\b",
    r"\b\d+(\.\d+)?\s*units?\b[^.]{0,60}\b(before|after|ok|okay|enough|dinner|lunch|breakfast|meal)\b",
    # Medication / drug prescription
    r"\b(prescribe|prescription)\b",
    r"\b(metformin|glipizide|ozempic|victoza|jardiance|insulin)\b.*\b(dose|dosage|amount)\b",
    r"\bwhat\s+dose\b",
    # Medication change / skipping ("can I skip my metformin today")
    r"\b(skip|skipping|skipped|stop|stopping|stopped|quit|quitting|start|starting|started|double|doubling|doubled|halve|halving|miss|missed|missing|change|changing|changed|reduce|reducing|reduced|increase|increasing|increased)\b[^.]{0,50}\b(metformin|insulin|glipizide|ozempic|victoza|jardiance|lantus|novolog|humalog|glargine|medication|medicine|pill|pills|tablet|dose|dosage)\b",
    r"\b(metformin|insulin|glipizide|ozempic|victoza|jardiance|lantus|novolog|humalog|glargine|medication|medicine)\b[^.]{0,50}\b(skip|stop|quit|double|halve|miss|change|reduce|increase)\b",
    r"\btake\s+two\b",
    # Clinical diagnosis
    r"\bdiagnose\b",
    r"\bdo\s+i\s+have\s+diabetes\b",
    r"\bam\s+i\s+diabetic\b",
    r"\bmedical\s+diagnosis\b",
]

UNSAFE_PATTERNS_UR = [
    # NOTE: bare "انسولین" alone is NOT unsafe — educational questions like
    # "انسولین کیا ہے؟" (what is insulin?) must be answered, not refused.
    r"انسولین.*(کتن|خوراک|مقدار|یونٹ|لگانا|لگاؤ|لگاؤں|ڈوز|تجویز)",
    r"(کتنا|کتنی).*(دوا|خوراک|مقدار)",
    r"دوا.*(خوراک|مقدار|نسخہ|ڈوز)",
    r"(چھوڑ|چھوڑوں|بند|روک|دگنی|آدھی).*(دوا|دوائی|انسولین|میٹفارمین)",
    r"(دوا|دوائی|انسولین).*(چھوڑ|بند|دگنی|آدھی|خوراک)",
    r"تشخیص",
    r"ذیابیطس.*(تشخیص|علاج)",
]

# Unsafe query patterns (Roman Urdu — how many users actually type)
UNSAFE_PATTERNS_ROMAN = [
    r"\binsulin\b.*\b(kitni|kitna|kitne|leni|len|loon|dose|doz|units?)\b",
    r"\b(kitni|kitna|kitne)\b.*\binsulin\b",
    r"\binsulin\b.*\b(khaon|khani|lagani|lagaoon|lagaon|lagana)\b",
    # "kitne unit lagaon" without the word insulin
    r"\b(kitne|kitni|kitna)\s+(unit|units)\b",
    r"\bunits?\s+(lagaon|lagao|laga|loon|lena|khaon|lein)\b",
    r"\b(metformin|dawai|dawa)\b.*\b(kitni|dose|doz|khurak|miqdar)\b",
    # medication change / skipping
    r"\b(skip|chor|chorna|chhor|band|double|adhi)\b.*\b(dawa|dawai|insulin|metformin)\b",
    r"\b(dawa|dawai|insulin|metformin)\b.*\b(skip|chor|chorna|band|double|adhi)\b",
    r"\bkya\s+mujhe\s+(diabetes|shugar|sugar)\s+hai\b",
    r"\bmujhe\s+(diabetes|shugar|sugar)\s+hai\b.*\b(batao|bataen|confirm)\b",
    r"\bshugar\s+ki\s+(dawa|dawai)\b.*\b(kitni|dose|doz)\b",
]

PRE_LLM_REFUSAL_EN = (
    "I cannot recommend insulin dosages, calculate medication units, or provide medical diagnoses. "
    "GlycoTwin AI Coach offers educational guidance on glycemic responses to meals and lifestyle choices. "
    f"\n\n{DISCLAIMER_EN}"
)

PRE_LLM_REFUSAL_UR = (
    "میں انسولین کی مقدار، دوا کی خوراک، یا طبی تشخیص تجویز نہیں کر سکتا۔ "
    "گلائیکو ٹوئن اے آئی کوچ صرف کھانے اور طرز زندگی سے متعلق تعلیمی معلومات فراہم کرتا ہے۔ "
    f"\n\n{DISCLAIMER_UR}"
)


# ---------------------------------------------------------------------------
# Hypoglycaemia / emergency routing.
# A low-glucose reading with symptoms is an emergency, not a refusal case:
# the coach must give immediate first-aid guidance (the standard 15-15 rule),
# never a walk or a generic paragraph.
# ---------------------------------------------------------------------------
EMERGENCY_PATTERNS_EN = [
    r"\b(4[0-9]|5[0-9]|6[0-9])\b[^.]{0,60}\b(shaky|shaking|sweat|sweating|dizzy|dizziness|faint|fainting|confus|blurry|hungry|weak|palpitat|trembl)\b",
    r"\b(shaky|shaking|sweat|sweating|dizzy|dizziness|faint|fainting|confus|trembl)\b[^.]{0,60}\b(4[0-9]|5[0-9]|6[0-9])\b",
    r"\b(hypo|hypoglycaemia|hypoglycemia|low blood sugar|low sugar)\b",
    r"\b(unconscious|passed out|seizure|convulsion)\b",
]
EMERGENCY_PATTERNS_UR = [
    r"(شوگر|گلوکوز|شکر).{0,40}(کم|گر)",
    r"(کانپ|کپکپی|پسینہ|چکر|بے ہوش|دھندلا)",
]
EMERGENCY_PATTERNS_ROMAN = [
    r"\b(shugar|sugar|glucose)\s+(low|kam|gir)",
    r"\b(low|kam)\s+(shugar|sugar)\b",
    r"\b(kaanp|pasina|chakkar|behosh)\b",
]

EMERGENCY_EN = (
    "This sounds like LOW blood sugar (hypoglycaemia), which needs immediate action — "
    "do NOT go for a walk right now.\n\n"
    "1. Have 15 grams of fast-acting carbohydrate right away (e.g. 3-4 glucose tablets, "
    "half a cup of fruit juice, or a tablespoon of honey).\n"
    "2. Wait 15 minutes, then re-check your glucose.\n"
    "3. If it is still below 70 mg/dL, repeat step 1.\n"
    "4. Do not drive. If you feel faint, cannot swallow, or someone with you becomes "
    "unconscious or has a seizure, call emergency services immediately.\n\n"
    "Once you are stable, talk to your doctor about what caused this episode.\n\n"
    f"{DISCLAIMER_EN}"
)

EMERGENCY_UR = (
    "یہ کم بلڈ شوگر (ہائپوگلیسیمیا) معلوم ہوتی ہے جس پر فوری عمل درکار ہے — "
    "اس وقت چہل قدمی نہ کریں۔\n\n"
    "1. فوراً 15 گرام تیز اثر کاربوہائیڈریٹ لیں (مثلاً 3-4 گلوکوز کی گولیاں، "
    "آدھا کپ پھلوں کا رس، یا ایک چمچ شہد)۔\n"
    "2. 15 منٹ انتظار کریں پھر شوگر دوبارہ چیک کریں۔\n"
    "3. اگر شوگر اب بھی 70 سے کم ہو تو پہلا قدم دہرائیں۔\n"
    "4. گاڑی نہ چلائیں۔ اگر بے ہوشی محسوس ہو، نگلنے میں دقت ہو، یا کوئی بے ہوش ہو جائے "
    "تو فوراً ایمرجنسی سروس کو کال کریں۔\n\n"
    "مستحکم ہونے کے بعد اس واقعے کی وجہ کے بارے میں اپنے معالج سے بات کریں۔\n\n"
    f"{DISCLAIMER_UR}"
)


def detect_emergency(query_text: str, language: str = "en") -> str | None:
    """Return the emergency first-aid message if the query describes a
    hypoglycaemic episode, else None. Checked BEFORE the refusal gate."""
    text_lower = query_text.lower()
    for pattern in EMERGENCY_PATTERNS_EN:
        if re.search(pattern, text_lower):
            return EMERGENCY_UR if language == "ur" else EMERGENCY_EN
    for pattern in EMERGENCY_PATTERNS_ROMAN:
        if re.search(pattern, text_lower):
            return EMERGENCY_UR if language == "ur" else EMERGENCY_EN
    for pattern in EMERGENCY_PATTERNS_UR:
        if re.search(pattern, query_text):
            return EMERGENCY_UR if language == "ur" else EMERGENCY_EN
    return None


def evaluate_pre_llm_input(query_text: str, language: str = "en") -> tuple[bool, str | None]:
    """Inspect user input query for medical safety violations.

    Returns (is_safe, refusal_reason_or_message).
    If is_safe is False, refusal_reason_or_message contains the safe refusal text.
    """
    text_lower = query_text.lower()

    # Check English patterns
    for pattern in UNSAFE_PATTERNS_EN:
        if re.search(pattern, text_lower):
            refusal = PRE_LLM_REFUSAL_UR if language == "ur" else PRE_LLM_REFUSAL_EN
            return False, refusal

    # Check Roman Urdu patterns (on the lowered text)
    for pattern in UNSAFE_PATTERNS_ROMAN:
        if re.search(pattern, text_lower):
            refusal = PRE_LLM_REFUSAL_UR if language == "ur" else PRE_LLM_REFUSAL_EN
            return False, refusal

    # Check Urdu patterns
    for pattern in UNSAFE_PATTERNS_UR:
        if re.search(pattern, query_text):
            refusal = PRE_LLM_REFUSAL_UR if language == "ur" else PRE_LLM_REFUSAL_EN
            return False, refusal

    return True, None


# Unsafe *generated-output* patterns: dosage/diagnosis statements phrased as
# instructions to the user. Deliberately narrow (verb + number + unit, or
# "your dose should be") so educational text that merely mentions insulin or
# units in general terms is not blocked. This gate matters most when a live
# LLM is enabled: the pre-LLM gate only sees the question, not the answer.
OUTPUT_UNSAFE_PATTERNS = [
    r"\b(take|inject|administer|bolus)\s+\d+(\.\d+)?\s*(units?|iu|ml)\b",
    r"\b\d+(\.\d+)?\s*units?\s+of\s+(insulin|novolog|humalog|lantus|glargine)\b",
    r"\byour\s+(insulin\s+)?(dose|dosage)\s+(is|should\s+be|would\s+be)\b",
    r"\b(increase|decrease|raise|lower|adjust)\s+(your\s+)?(insulin|dose|dosage|metformin)\b[^.]*\b(to|by)\s+\d+",
    r"\bi\s+(recommend|suggest|advise)\s+(taking|injecting)\s+\d+",
    r"انسولین.*\d+\s*(یونٹ|یونٹس)",
    r"\b\d+\s*(unit|units)\s+insulin\b.*\b(le\s*lo|lagao|lagayein|kha\s*lo)\b",
]


DISCLAIMER_PATTERNS = [
    r"(?i)disclaimer:\s*glycotwin ai coach provides educational decision-support insights only and does not provide medical diagnosis,\s*treatment,\s*or insulin dosage recommendations\.?\s*please consult a qualified healthcare professional for medical advice\.?",
    r"(?i)for personalized nutrition plans or specific health concerns,\s*please consult your healthcare provider or a registered dietitian\.?",
    r"(?i)please consult a qualified healthcare professional for medical advice\.?",
    r"(?i)disclaimer:\s*glycotwin ai coach provides educational decision-support insights only[^.\n]*\.?",
    r"تنبیہ:\s*گلائیکو ٹوئن اے آئی کوچ صرف تعلیمی اور فیصلے کی معاونت کی معلومات فراہم کرتا ہے[^.\n]*",
    r"طبی مشورے کے لیے براہ کرم کسی قابل معالج سے رجوع کریں۔",
]


def sanitize_coach_text(text: str) -> str:
    """Strip boilerplate repetitive disclaimers and referral sentences from response text.

    The client UI already renders verified medical guardrail badges and disclaimers,
    so repeating paragraphs of boilerplate in every chat bubble is redundant.
    """
    cleaned = text
    for pat in DISCLAIMER_PATTERNS:
        cleaned = re.sub(pat, "", cleaned)
    # Strip trailing whitespace and collapse consecutive newlines
    cleaned = re.sub(r"\n\s*\n\s*\n+", "\n\n", cleaned)
    return cleaned.strip()


def enforce_post_llm_safety(
    response_text: str, language: str = "en"
) -> tuple[str, bool, bool]:
    """Inspect and clean LLM response text, enforcing mandatory safety policies.

    A generated answer that instructs a specific dose (or similar) is replaced
    wholesale by the refusal text and reported with safety_passed=False —
    stapling a disclaimer onto a dosage instruction is not a safety outcome.

    Returns (final_text, safety_passed, disclaimer_included).
    """
    lowered = response_text.lower()
    for pattern in OUTPUT_UNSAFE_PATTERNS:
        if re.search(pattern, lowered) or re.search(pattern, response_text):
            refusal = PRE_LLM_REFUSAL_UR if language == "ur" else PRE_LLM_REFUSAL_EN
            return refusal, False, True

    # For safe educational responses, strip redundant boilerplate disclaimers from the body text
    # while reporting disclaimer_included=True so client-side clinical verification badges render.
    cleaned_text = sanitize_coach_text(response_text)
    return cleaned_text, True, True
