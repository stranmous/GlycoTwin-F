import json
import re
from collections.abc import Generator

from app.modules.m8_coach.llm_provider import LLMProvider
from app.modules.m8_coach.prompt_formatter import format_rag_prompt
from app.modules.m8_coach.rag_service import retrieve_context
from app.modules.m8_coach.safety_guard import (
    PRE_LLM_REFUSAL_EN,
    PRE_LLM_REFUSAL_UR,
    detect_emergency,
    enforce_post_llm_safety,
    evaluate_pre_llm_input,
)
from app.modules.m8_coach.schemas import AICoachQuery, AICoachResponse


class _LazyLLMProvider:
    """Module-level stand-in for ``llm_provider``.

    Builds the real LLMProvider on first attribute use, so importing this
    module performs no configuration reads with side effects. setattr lands
    on the proxy, so tests can monkeypatch methods on it directly.
    """

    def __init__(self) -> None:
        object.__setattr__(self, "_instance", None)

    def _real(self) -> LLMProvider:
        inst = object.__getattribute__(self, "_instance")
        if inst is None:
            inst = LLMProvider()
            object.__setattr__(self, "_instance", inst)
        return inst

    def __getattr__(self, name: str):
        return getattr(self._real(), name)


llm_provider = _LazyLLMProvider()


def _emergency_response(query: AICoachQuery, message: str) -> AICoachResponse:
    """Hypoglycaemia first-aid: safe, sanctioned, never refused."""
    return AICoachResponse(
        response_text=message,
        language=query.language,
        sources_referenced=["ADA hypoglycaemia guidance"],
        safety_passed=True,
        disclaimer_included=True,
    )


def process_coach_query(query: AICoachQuery) -> AICoachResponse:
    """Orchestrate Module 8 AI Coach retrieval-augmented generation and medical safety layer."""
    # Step 0: Hypoglycaemia emergency routing (before the refusal gate)
    emergency = detect_emergency(query.query_text, query.language)
    if emergency:
        return _emergency_response(query, emergency)

    # Step 1: Pre-LLM Safety Gate
    is_safe, refusal = evaluate_pre_llm_input(query.query_text, query.language)
    if not is_safe and refusal:
        return AICoachResponse(
            response_text=refusal,
            language=query.language,
            sources_referenced=[],
            safety_passed=False,
            disclaimer_included=True,
        )

    # Step 2: Context Retrieval
    snippets, sources = retrieve_context(query.query_text, query.language)

    # Step 3: Prompt Formatting
    prompt = format_rag_prompt(query, snippets)

    # Step 4: Response Generation via LLMProvider
    raw_response = llm_provider.generate_response(prompt, query.language)

    # Step 5: Post-LLM Safety Gate
    final_text, safety_passed, disclaimer_included = enforce_post_llm_safety(
        raw_response, query.language
    )

    return AICoachResponse(
        response_text=final_text,
        language=query.language,
        sources_referenced=sources,
        safety_passed=safety_passed,
        disclaimer_included=disclaimer_included,
    )


def stream_coach_query(query: AICoachQuery) -> Generator[str, None, None]:
    """Stream Module 8 AI Coach responses using SSE format with medical safety guardrail inspection."""
    # Step 0: Hypoglycaemia emergency routing (before the refusal gate)
    emergency = detect_emergency(query.query_text, query.language)
    if emergency:
        payload = json.dumps({
            "chunk": emergency,
            "is_final": True,
            "safety_passed": True,
            "disclaimer_included": True,
            "sources_referenced": ["ADA hypoglycaemia guidance"],
        })
        yield f"data: {payload}\n\n"
        return

    # Step 1: Pre-LLM Safety Gate
    is_safe, refusal = evaluate_pre_llm_input(query.query_text, query.language)
    if not is_safe and refusal:
        payload = json.dumps({
            "chunk": refusal,
            "is_final": True,
            "safety_passed": False,
            "disclaimer_included": True,
            "sources_referenced": [],
        })
        yield f"data: {payload}\n\n"
        return

    # Step 2: Context Retrieval & Prompt Formatting
    snippets, sources = retrieve_context(query.query_text, query.language)
    prompt = format_rag_prompt(query, snippets)

    # Step 3: Stream response chunks with an incremental output gate.
    # The accumulated text is scanned against the unsafe-output patterns as it
    # grows; on a hit the stream is cut and replaced by the refusal, so a
    # dosage instruction can never be delivered mid-stream with
    # safety_passed=True.
    from app.modules.m8_coach.safety_guard import OUTPUT_UNSAFE_PATTERNS

    full_text = ""
    aborted = False
    for chunk in llm_provider.stream_response(prompt, query.language):
        full_text += chunk
        lowered = full_text.lower()
        if any(re.search(p, lowered) or re.search(p, full_text)
               for p in OUTPUT_UNSAFE_PATTERNS):
            aborted = True
            break
        payload = json.dumps({"chunk": chunk, "is_final": False})
        yield f"data: {payload}\n\n"

    if aborted:
        refusal = PRE_LLM_REFUSAL_UR if query.language == "ur" else PRE_LLM_REFUSAL_EN
        payload = json.dumps({
            "chunk": refusal,
            "is_final": True,
            "safety_passed": False,
            "disclaimer_included": True,
            "sources_referenced": [],
        })
        yield f"data: {payload}\n\n"
        return

    # Step 4: Post-LLM Safety Enforcement on the completed text.
    # The incremental scan above already cut unsafe streams; this final pass
    # applies the same gate as the non-streaming path (defence in depth) and
    # ensures the disclaimer is present.
    final_text, safety_passed, disclaimer_included = enforce_post_llm_safety(
        full_text, query.language
    )
    if final_text != full_text:
        # Gate rewrote the text (unsafe output or appended disclaimer):
        # deliver the corrected tail so the client sees what was judged.
        tail = final_text[len(full_text):]
        if tail:
            payload = json.dumps({"chunk": tail, "is_final": False})
            yield f"data: {payload}\n\n"

    # Step 5: Stream completion marker (reports the gate's real verdict)
    final_payload = json.dumps({
        "chunk": "",
        "is_final": True,
        "safety_passed": safety_passed,
        "disclaimer_included": disclaimer_included,
        "sources_referenced": sources if safety_passed else [],
    })
    yield f"data: {final_payload}\n\n"


def answer_question(request: AICoachQuery) -> AICoachResponse:
    """Alias for backwards compatibility."""
    return process_coach_query(request)
