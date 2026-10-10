from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.firebase import CurrentUser
from app.schemas.insight import InsightsSummary
from app.services.insights import build_summary

router = APIRouter(prefix="/v1/insights", tags=["insights"])


@router.get("/summary", response_model=InsightsSummary)
async def get_summary(
    user: CurrentUser,
    window: Literal["today", "7d", "30d"] = "7d",
    session: AsyncSession = Depends(get_session),
):
    return await build_summary(session, user.id, window)
