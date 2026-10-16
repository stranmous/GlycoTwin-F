from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user
from app.modules.m8_coach.schemas import AICoachQuery, AICoachResponse
from app.modules.m8_coach.service import process_coach_query, stream_coach_query

router = APIRouter()


@router.get("/status")
def status() -> dict[str, str]:
    return {"module": "8", "name": "ai-coach-rag", "status": "active"}


@router.post("/query", response_model=AICoachResponse)
def query_ai_coach(payload: AICoachQuery,
                   user_id: str = Depends(get_current_user)) -> AICoachResponse:
    """Process RAG query with pre/post-LLM medical safety guardrails."""
    payload.user_id = user_id  # the token, not the client, decides who asks
    return process_coach_query(payload)


@router.post("/stream")
def stream_ai_coach(payload: AICoachQuery,
                    user_id: str = Depends(get_current_user)) -> StreamingResponse:
    """Stream RAG query response using Server-Sent Events (SSE) with medical safety guardrails."""
    payload.user_id = user_id
    return StreamingResponse(
        stream_coach_query(payload),
        media_type="text/event-stream",
    )
