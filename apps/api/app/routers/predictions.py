import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.firebase import CurrentUser
from app.models.meal import Meal
from app.models.prediction import Prediction
from app.schemas.prediction import GlucosePoint, PredictionIn, PredictionOut
from app.services.glucose_model import baseline_curve, summarize

router = APIRouter(prefix="/v1/predictions", tags=["predictions"])


@router.post("/baseline", response_model=PredictionOut)
async def create_baseline(
    payload: PredictionIn,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    meal = (
        await session.execute(
            select(Meal).where(Meal.id == payload.meal_id, Meal.user_id == user.id)
        )
    ).scalar_one_or_none()
    if meal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meal not found")

    # Delete existing prediction for this meal to avoid duplicates when user edits
    existing_preds = await session.execute(
        select(Prediction).where(Prediction.meal_id == meal.id)
    )
    for ep in existing_preds.scalars():
        await session.delete(ep)
    await session.commit()

    points = baseline_curve(meal.total_carbs_g, user.weight_kg or 70.0)
    peak, peak_at, tar = summarize(points)
    pred = Prediction(
        user_id=user.id,
        meal_id=meal.id,
        curve=[{"t_min": p.t_min, "mgdl": p.mgdl} for p in points],
        peak_mgdl=peak,
        peak_at_min=peak_at,
        time_above_range_min=tar,
    )
    session.add(pred)
    await session.commit()
    await session.refresh(pred)
    return PredictionOut(
        id=pred.id,
        meal_id=pred.meal_id,
        curve=[GlucosePoint(**p) for p in pred.curve],
        peak_mgdl=pred.peak_mgdl,
        peak_at_min=pred.peak_at_min,
        time_above_range_min=pred.time_above_range_min,
        created_at=pred.created_at,
    )
