from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_session
from app.core.firebase import CurrentUser
from app.models.user import Medication, User
from app.schemas.user import UserOut, UserProfileIn

router = APIRouter(prefix="/v1/me", tags=["me"])


async def _load_user(user_id, session: AsyncSession) -> User:
    result = await session.execute(
        select(User).options(selectinload(User.medications)).where(User.id == user_id)
    )
    return result.scalar_one()


@router.get("", response_model=UserOut)
async def get_me(user: CurrentUser, session: AsyncSession = Depends(get_session)):
    return await _load_user(user.id, session)


@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: UserProfileIn,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    # Reload with medications eagerly before we iterate / mutate them.
    db_user = await _load_user(user.id, session)

    for field in (
        "display_name", "age", "sex", "height_cm", "weight_kg", "diabetes_type",
        "timezone", "usual_meal_times", "preferred_language",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(db_user, field, value)

    if payload.consent_accepted:
        db_user.consent_accepted_at = datetime.now(timezone.utc)

    if payload.medications is not None:
        for existing in list(db_user.medications):
            await session.delete(existing)
        for med in payload.medications:
            session.add(Medication(user_id=db_user.id, **med.model_dump()))

    await session.commit()
    return await _load_user(db_user.id, session)
