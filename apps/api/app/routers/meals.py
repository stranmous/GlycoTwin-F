import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import get_session
from app.core.firebase import CurrentUser
from app.models.meal import DetectedFood, Meal
from app.schemas.meal import MealIn, MealOut
from app.services.storage import save_meal_image
from app.services.vision import detect_foods

router = APIRouter(prefix="/v1/meals", tags=["meals"])


@router.post("/image", response_model=MealOut)
async def upload_meal_image(
    user: CurrentUser,
    image: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    contents = await image.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image too large (max 10 MB)")
    image_url = save_meal_image(contents)

    detections = detect_foods(contents)
    total_carbs = sum(d.carbs_g for d in detections)
    total_kcal = sum(d.kcal for d in detections)
    confidence = sum(d.confidence for d in detections) / max(len(detections), 1)

    meal = Meal(
        user_id=user.id,
        image_url=image_url,
        eaten_at=datetime.now(timezone.utc),
        total_carbs_g=total_carbs,
        total_kcal=total_kcal,
        confidence=round(confidence, 2),
        user_edited=False,
    )
    session.add(meal)
    await session.flush()
    for d in detections:
        session.add(DetectedFood(
            meal_id=meal.id,
            name_en=d.name_en,
            name_ur=d.name_ur,
            portion_g=d.portion_g,
            carbs_g=d.carbs_g,
            kcal=d.kcal,
            confidence=d.confidence,
        ))
    await session.commit()

    from app.models.prediction import Prediction
    from app.services.glucose_model import baseline_curve, summarize

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

    result = await session.execute(
        select(Meal).options(selectinload(Meal.detected_foods)).where(Meal.id == meal.id)
    )
    return result.scalar_one()


@router.get("", response_model=list[MealOut])
async def list_meals(
    user: CurrentUser,
    limit: int = Query(default=30, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Meal)
        .options(selectinload(Meal.detected_foods))
        .where(Meal.user_id == user.id)
        .order_by(Meal.eaten_at.desc())
        .limit(limit)
    )
    return list(result.scalars())


@router.get("/{meal_id}", response_model=MealOut)
async def get_meal(
    meal_id: uuid.UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Meal)
        .options(selectinload(Meal.detected_foods))
        .where(Meal.id == meal_id, Meal.user_id == user.id)
    )
    meal = result.scalar_one_or_none()
    if meal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meal not found")
    return meal


@router.put("/{meal_id}", response_model=MealOut)
async def update_meal(
    meal_id: uuid.UUID,
    payload: MealIn,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Meal)
        .options(selectinload(Meal.detected_foods))
        .where(Meal.id == meal_id, Meal.user_id == user.id)
    )
    meal = result.scalar_one_or_none()
    if meal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meal not found")

    if payload.eaten_at:
        meal.eaten_at = payload.eaten_at
    meal.meal_type = payload.meal_type
    meal.note = payload.note
    meal.user_edited = True

    meal.total_carbs_g = sum(f.carbs_g for f in payload.detected_foods)
    meal.total_kcal = sum(f.kcal for f in payload.detected_foods)
    meal.confidence = round(
        sum(f.confidence for f in payload.detected_foods) / max(len(payload.detected_foods), 1), 2
    )

    for existing in list(meal.detected_foods):
        await session.delete(existing)
    for food in payload.detected_foods:
        session.add(DetectedFood(meal_id=meal.id, **food.model_dump()))

    await session.commit()

    refreshed = await session.execute(
        select(Meal).options(selectinload(Meal.detected_foods)).where(Meal.id == meal.id)
    )
    return refreshed.scalar_one()

@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(
    meal_id: uuid.UUID,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Meal).where(Meal.id == meal_id, Meal.user_id == user.id))
    meal = result.scalar_one_or_none()
    if meal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meal not found")
    await session.delete(meal)
    await session.commit()
