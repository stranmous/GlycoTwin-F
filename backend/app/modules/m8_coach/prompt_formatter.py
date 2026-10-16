from app.modules.m8_coach.schemas import AICoachQuery


def format_rag_prompt(query: AICoachQuery, context_documents: list[str]) -> str:
    """Format bilingual RAG prompt for LLM coaching generation.

    Supports English ('en') and Urdu ('ur') languages.
    """
    context_block = "\n".join(f"- {doc}" for doc in context_documents)

    if query.language == "ur":
        return _format_urdu_prompt(query, context_block)
    return _format_english_prompt(query, context_block)


def _format_english_prompt(query: AICoachQuery, context_block: str) -> str:
    prompt_lines = [
        "System: You are GlycoTwin AI Coach, an educational decision-support assistant.",
        "Your role is to explain glucose trajectories and lifestyle impacts without giving medical diagnosis or dosage advice.",
        "",
        f"User Query: {query.query_text}",
    ]

    if query.meal_context:
        mc = query.meal_context
        prompt_lines.append(
            f"Meal Context: {mc.meal_name or 'Meal'} (Carbs: {mc.carbs_g or 0}g, "
            f"Protein: {mc.protein_g or 0}g, Fat: {mc.fat_g or 0}g, Fiber: {mc.fiber_g or 0}g)"
        )

    if query.trajectory_summary:
        ts = query.trajectory_summary
        prompt_lines.append(
            f"Trajectory Summary: Peak Glucose = {ts.peak_glucose_mg_dl:.1f} mg/dL at {ts.time_to_peak_min} min, "
            f"iAUC = {ts.iauc:.1f}, Elevation Level = {ts.glucose_elevation_level}"
        )

    if context_block:
        prompt_lines.extend(["", "Retrieved Educational Guidelines:", context_block])

    prompt_lines.extend(
        [
            "",
            "Instructions:",
            "1. Ground your response primarily in the Retrieved Educational Guidelines above whenever available.",
            "2. For general metabolic health, lifestyle, sleep, physical activity, hydration, or nutrition questions, provide clear, evidence-based educational explanations grounded in American Diabetes Association (ADA) and International Diabetes Federation (IDF) standards.",
            "3. Answer warmly, concisely, and supportively in the same language or dialect the user is using (e.g. Roman Urdu, English, or Urdu).",
            "4. NEVER calculate, prescribe, or recommend specific medication doses or insulin units.",
            "5. NEVER diagnose medical conditions.",
            "6. Provide direct, practical educational insights. Do NOT include boilerplate referral disclaimers or repetitive closing reminders to consult a doctor or registered dietitian (e.g. do NOT include 'For personalized nutrition plans or specific health concerns, please consult your healthcare provider or a registered dietitian'), as the app's user interface already displays verified medical guardrails and disclaimers automatically.",
        ]
    )

    return "\n".join(prompt_lines)


def _format_urdu_prompt(query: AICoachQuery, context_block: str) -> str:
    prompt_lines = [
        "سسٹم: آپ گلائیکو ٹوئن اے آئی کوچ ہیں، جو گلوکوز کی سطح کے بارے میں تعلیمی معلومات فراہم کرتا ہے۔",
        "آپ کا کام کھانے اور طرز زندگی کا گلوکوز پر اثر بتانا ہے، بغیر کسی طبی تشخیص یا دوا کی مقدار بتائے۔",
        "",
        f"صارف کا سوال: {query.query_text}",
    ]

    if query.meal_context:
        mc = query.meal_context
        prompt_lines.append(
            f"کھانے کی تفصیل: {mc.meal_name or 'کھانا'} (کاربوہائیڈریٹ: {mc.carbs_g or 0} گرام، "
            f"پروٹین: {mc.protein_g or 0} گرام، چکنائی: {mc.fat_g or 0} گرام، فائبر: {mc.fiber_g or 0} گرام)"
        )

    if query.trajectory_summary:
        ts = query.trajectory_summary
        prompt_lines.append(
            f"گلوکوز کی صورتحال: زیادہ سے زیادہ گلوکوز = {ts.peak_glucose_mg_dl:.1f} mg/dL ({ts.time_to_peak_min} منٹ پر)، "
            f"iAUC = {ts.iauc:.1f}"
        )

    if context_block:
        prompt_lines.extend(["", "تعلیمی رہنمائی:", context_block])

    prompt_lines.extend(
        [
            "",
            "ہدایات:",
            "1. اگر اوپر تعلیمی رہنمائی دی گئی ہو تو اس کی روشنی میں آسان اور واضح جواب دیں۔",
            "2. طرز زندگی، نیند، چہل قدمی، پانی یا غذائیت سے متعلق سوالات کے لیے، اے ڈی اے (ADA) اور بین الاقوامی طبی رہنمائی کے مطابق انسولین کی حساسیت اور گلوکوز کے توازن کی تعلیمی وضاحت کریں۔",
            "3. صارف کے انداز اور زبان (اردو یا رومن اردو) کے مطابق حوصلہ افزا اور آسان انداز میں جواب دیں۔",
            "4. دوا یا انسولین کی مخصوص مقدار یا خوراک ہرگز تجویز نہ کریں۔",
            "5. کوئی طبی تشخیص ہرگز نہ دیں۔",
            "6. براہ راست اور واضح تعلیمی رہنمائی فراہم کریں۔ جواب کے آخر میں معالج یا ڈائیٹیشن سے مشورے کے بار بار دہرائے جانے والے رسمی جملے شامل نہ کریں، کیونکہ ایپلیکیشن کا یوزر انٹرفیس پہلے ہی طبی انتباہ خودکار طور پر ظاہر کرتا ہے۔",
        ]
    )

    return "\n".join(prompt_lines)
