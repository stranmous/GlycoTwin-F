from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.modules.m1_ingestion.anomaly_detector import (
    AnomalyDetectionRequest,
    AnomalyDetectionResult,
    detect_cgm_anomalies,
)
from app.modules.m1_ingestion.db_models import GlucoseReading, MealLog
from app.modules.m1_ingestion.schemas import (
    CGMReadingPayload,
    IngestedUserData,
    MealRecordPayload,
    UserProfilePayload,
)
from app.modules.m1_ingestion.service import (
    normalize_ingested_user_data,
    validate_cgm_series,
    validate_meal_record,
)

router = APIRouter()


@router.get("/status")
def status_endpoint() -> dict[str, str]:
    return {"module": "1", "name": "multi-modal-data-ingestion", "status": "active"}


@router.post("/cgm", status_code=status.HTTP_200_OK)
async def ingest_cgm_readings(
    readings: list[CGMReadingPayload],
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Validate and persist the user's CGM readings (the twin's memory)."""
    try:
        validated_readings = validate_cgm_series(readings, require_sorted=False)
        for r in validated_readings:
            db.add(GlucoseReading(
                user_id=user_id,
                glucose_mg_dl=r.glucose_mg_dl,
                recorded_at=r.timestamp,
                source="cgm",
            ))
        await db.commit()
        return {
            "status": "success",
            "count": len(validated_readings),
            "readings": [r.model_dump(mode="json") for r in validated_readings],
        }
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(err)
        ) from err


def _save_image_if_base64(image_url: str | None) -> str | None:
    if not image_url:
        return None
    if image_url.startswith("data:image/"):
        try:
            import base64
            import uuid
            from pathlib import Path
            header, encoded = image_url.split(",", 1)
            ext = "jpg"
            if "png" in header:
                ext = "png"
            elif "webp" in header:
                ext = "webp"
            img_bytes = base64.b64decode(encoded)
            uploads_dir = Path("uploads/meals")
            uploads_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{uuid.uuid4()}.{ext}"
            (uploads_dir / filename).write_bytes(img_bytes)
            return f"/uploads/meals/{filename}"
        except Exception:
            return None
    return image_url


@router.post("/meal", status_code=status.HTTP_200_OK)
@router.post("/history/meals", status_code=status.HTTP_200_OK)
async def ingest_meal_record(
    meal: MealRecordPayload,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Validate and persist a logged meal."""
    try:
        validated_meal = validate_meal_record(meal)
        label = validated_meal.name or validated_meal.dish_label or (
            validated_meal.detected_foods[0].get("name_en") if validated_meal.detected_foods else "Meal"
        )
        resolved_img = _save_image_if_base64(meal.image_url)
        db_meal = MealLog(
            user_id=user_id,
            dish_label=label,
            carbs_g=validated_meal.carbohydrates_g,
            protein_g=validated_meal.protein_g,
            fat_g=validated_meal.fat_g,
            fiber_g=validated_meal.fiber_g,
            image_url=resolved_img,
            logged_at=validated_meal.timestamp,
            source="manual",
        )
        db.add(db_meal)
        await db.commit()
        await db.refresh(db_meal)
        return {
            "status": "success",
            "id": db_meal.id,
            "meal_id": db_meal.id,
            "meal": validated_meal.model_dump(mode="json"),
        }
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(err)
        ) from err


@router.put("/history/meals/{meal_id}", status_code=status.HTTP_200_OK)
async def update_meal_record(
    meal_id: str,
    meal: MealRecordPayload,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update or upsert a logged meal."""
    existing = (await db.execute(
        select(MealLog).where(MealLog.id == meal_id, MealLog.user_id == user_id)
    )).scalar_one_or_none()

    label = meal.name or meal.dish_label or (
        meal.detected_foods[0].get("name_en") if meal.detected_foods else "Meal"
    )
    resolved_img = _save_image_if_base64(meal.image_url)
    if existing:
        existing.dish_label = label
        existing.carbs_g = meal.carbohydrates_g
        existing.protein_g = meal.protein_g
        existing.fat_g = meal.fat_g
        existing.fiber_g = meal.fiber_g
        if resolved_img:
            existing.image_url = resolved_img
        db_meal = existing
    else:
        db_meal = MealLog(
            id=meal_id,
            user_id=user_id,
            dish_label=label,
            carbs_g=meal.carbohydrates_g,
            protein_g=meal.protein_g,
            fat_g=meal.fat_g,
            fiber_g=meal.fiber_g,
            image_url=resolved_img,
            logged_at=meal.timestamp,
            source="manual",
        )
        db.add(db_meal)
    await db.commit()
    await db.refresh(db_meal)
    return {
        "status": "success",
        "id": db_meal.id,
        "meal_id": db_meal.id,
        "meal": meal.model_dump(mode="json"),
    }


@router.get("/history/readings")
async def reading_history(
    limit: int = 288,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """The user's stored glucose readings, newest first (twin over time)."""
    rows = (await db.execute(
        select(GlucoseReading)
        .where(GlucoseReading.user_id == user_id)
        .order_by(GlucoseReading.recorded_at.desc())
        .limit(min(limit, 5000))
    )).scalars().all()
    return {
        "status": "success",
        "count": len(rows),
        "readings": [
            {
                "glucose_mg_dl": r.glucose_mg_dl,
                "recorded_at": r.recorded_at.isoformat(),
                "timestamp": r.recorded_at.isoformat(),
                "source": r.source,
            }
            for r in rows
        ],
    }



def _format_utc(dt: datetime | None) -> str:
    if dt is None:
        return datetime.now(timezone.utc).isoformat()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


@router.get("/history/meals")
async def get_meal_history(
    limit: int = 50,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List recent meals for the current user."""
    rows = (await db.execute(
        select(MealLog)
        .where(MealLog.user_id == user_id)
        .order_by(MealLog.logged_at.desc())
        .limit(min(limit, 500))
    )).scalars().all()
    return {
        "status": "success",
        "count": len(rows),
        "meals": [
            {
                "id": m.id,
                "meal_id": m.id,
                "dish_label": m.dish_label or "Meal",
                "name": m.dish_label or "Meal",
                "carbs_g": m.carbs_g,
                "total_carbs_g": m.carbs_g,
                "protein_g": m.protein_g,
                "fat_g": m.fat_g,
                "fiber_g": m.fiber_g,
                "kcal": round(m.carbs_g * 4 + m.protein_g * 4 + m.fat_g * 9),
                "total_kcal": round(m.carbs_g * 4 + m.protein_g * 4 + m.fat_g * 9),
                "image_url": m.image_url,
                "logged_at": _format_utc(m.logged_at),
                "eaten_at": _format_utc(m.logged_at),
                "created_at": _format_utc(m.created_at),
                "user_edited": True,
                "source": m.source,
                "detected_foods": [
                    {
                        "id": f"f-{m.id}",
                        "name_en": m.dish_label or "Meal",
                        "name_ur": "چکن کڑاہی" if m.dish_label == "Chicken Karahi" else None,
                        "portion_g": 300,
                        "carbs_g": m.carbs_g,
                        "kcal": round(m.carbs_g * 4 + m.protein_g * 4 + m.fat_g * 9),
                        "confidence": 0.95,
                    }
                ],
            }
            for m in rows
        ],
    }


@router.get("/history/meals/{meal_id}")
async def get_single_meal(
    meal_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get single meal by ID."""
    row = (await db.execute(
        select(MealLog).where(MealLog.id == meal_id, MealLog.user_id == user_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {
        "id": row.id,
        "meal_id": row.id,
        "dish_label": row.dish_label or "Meal",
        "name": row.dish_label or "Meal",
        "carbs_g": row.carbs_g,
        "total_carbs_g": row.carbs_g,
        "protein_g": row.protein_g,
        "fat_g": row.fat_g,
        "fiber_g": row.fiber_g,
        "kcal": round(row.carbs_g * 4 + row.protein_g * 4 + row.fat_g * 9),
        "total_kcal": round(row.carbs_g * 4 + row.protein_g * 4 + row.fat_g * 9),
        "image_url": row.image_url,
        "logged_at": _format_utc(row.logged_at),
        "eaten_at": _format_utc(row.logged_at),
        "created_at": _format_utc(row.created_at),
        "user_edited": True,
        "source": row.source,
        "detected_foods": [
            {
                "id": f"f-{row.id}",
                "name_en": row.dish_label or "Meal",
                "name_ur": "چکن کڑاہی" if row.dish_label == "Chicken Karahi" else None,
                "portion_g": 300,
                "carbs_g": row.carbs_g,
                "kcal": round(row.carbs_g * 4 + row.protein_g * 4 + row.fat_g * 9),
                "confidence": 0.95,
            }
        ],
    }


@router.delete("/meals/{meal_id}")
@router.delete("/history/meals/{meal_id}")
async def delete_meal(
    meal_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a meal log."""
    row = (await db.execute(
        select(MealLog).where(MealLog.id == meal_id, MealLog.user_id == user_id)
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return {"status": "success", "id": meal_id}


@router.post("/user", status_code=status.HTTP_200_OK)
def ingest_user_profile(
    user_profile: UserProfilePayload,
    user_id: str = Depends(get_current_user),
) -> dict:
    return {
        "status": "success",
        "user_profile": user_profile.model_dump(mode="json"),
    }


@router.post("/normalize", status_code=status.HTTP_200_OK)
def normalize_user_data(
    payload: IngestedUserData,
    user_id: str = Depends(get_current_user),
) -> dict:
    try:
        normalized = normalize_ingested_user_data(payload)
        return {
            "status": "success",
            "data": normalized.model_dump(mode="json"),
        }
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(err)
        ) from err


@router.post("/alerts", response_model=AnomalyDetectionResult, status_code=status.HTTP_200_OK)
def detect_alerts(
    payload: AnomalyDetectionRequest,
    user_id: str = Depends(get_current_user),
) -> AnomalyDetectionResult:
    """Analyze CGM time-series data for rate-of-change spikes, nocturnal dips, and glycemic anomalies."""
    return detect_cgm_anomalies(readings=payload.cgm_readings, user_id=payload.user_id)
