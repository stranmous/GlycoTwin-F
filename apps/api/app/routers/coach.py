from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.firebase import CurrentUser
from app.models.coach_message import CoachMessage
from app.schemas.coach import CoachMessageIn, CoachReply
from app.services.coach_rag import reply as coach_reply

router = APIRouter(prefix="/v1/coach", tags=["coach"])


@router.post("/messages", response_model=CoachReply)
async def send_message(
    payload: CoachMessageIn,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    # Belt-and-suspenders guard (Pydantic Field max_length=350 already rejects at 422).
    if len(payload.text) > 350:
        raise HTTPException(status_code=400, detail="Message too long (max 350 chars).")

    user_msg = CoachMessage(
        user_id=user.id,
        role="user",
        language=payload.language,
        text=payload.text,
    )
    session.add(user_msg)
    await session.flush()

    # Load last 14 messages from DB (server-side history — never trust client-supplied history)
    hist_rows = await session.execute(
        select(CoachMessage)
        .where(CoachMessage.user_id == user.id, CoachMessage.id != user_msg.id)
        .order_by(CoachMessage.created_at.desc(), CoachMessage.id.desc())
        .limit(14)
    )
    db_history = list(reversed(hist_rows.scalars().all()))

    result = await coach_reply(
        user_text=payload.text,
        language=payload.language,
        hidden_context=payload.hidden_context,
        chat_history=db_history,
    )

    bot_msg = CoachMessage(
        user_id=user.id,
        role="assistant",
        language=payload.language,
        text=result.text,
        safety_category=result.safety_category,
        follow_ups=result.follow_ups,
    )
    session.add(bot_msg)
    await session.commit()
    await session.refresh(bot_msg)

    return CoachReply(
        id=bot_msg.id,
        text=bot_msg.text,
        language=bot_msg.language,
        safety_category=result.safety_category,
        refs=[],
        mini_chart=None,
        follow_ups=result.follow_ups,
        created_at=bot_msg.created_at,
    )
