"""M5 routes: POST /estimate (meal photo), GET /dishes, GET /status.

Inference runs in a threadpool: the vision stages are blocking CPU work and
must not stall the event loop (the original code ran them inline).
"""
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.core.security import get_current_user
from app.modules.m1_ingestion.db_models import MealLog
from app.modules.m5_nutrition.scale import parse_reference_bbox
from app.modules.m5_nutrition.schemas import DishInfo, MealEstimateResponse
from app.modules.m5_nutrition.service import (
    list_dishes,
    run_estimate,
    verify_vision_weights,
    vision_mode,
)

log = get_logger("glycotwin.m5.router")
router = APIRouter()


@router.get("/status")
def status() -> dict[str, Any]:
    try:
        is_healthy, details, degraded_reasons = verify_vision_weights()
    except Exception as e:
        log.warning("Unexpected error verifying vision weights: %s", e)
        return {
            "module": "5",
            "name": "volumetric-nutrition-quantifier",
            "status": "degraded",
            "vision_mode": "fixture",
            "models": {},
            "degraded_models": [str(e)],
            "remediation": "python scripts/fetch_weights.py",
        }
    mode = "models" if is_healthy else "fixture"
    resp: dict[str, Any] = {
        "module": "5",
        "name": "volumetric-nutrition-quantifier",
        "status": "active",
        "vision_mode": mode,
        "models": details,
        "degraded_models": degraded_reasons,
    }
    if not is_healthy:
        resp["remediation"] = "python scripts/fetch_weights.py"
    return resp


@router.get("/dishes", response_model=list[DishInfo])
def dishes() -> list[dict]:
    return list_dishes()


@router.post("/estimate", response_model=MealEstimateResponse)
async def estimate(
    image: UploadFile = File(...),
    dish_hint: str | None = Form(default=None),
    reference_object_type: str = Form(default="coin"),
    reference_bbox: str | None = Form(default=None),
    plate_diameter_cm: float | None = Form(default=None),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    import uuid
    from datetime import UTC, datetime
    from pathlib import Path

    try:
        settings = get_settings()
        content = await image.read()
        cap = settings.meal_max_upload_mb * 1024 * 1024
        if len(content) > cap:
            raise HTTPException(
                status_code=413,
                detail=f"Image exceeds the {settings.meal_max_upload_mb} MB upload limit.",
            )

        # Save uploaded meal photo to static uploads directory
        uploads_dir = Path("uploads/meals")
        uploads_dir.mkdir(parents=True, exist_ok=True)
        ext = "jpg"
        if image.filename and "." in image.filename:
            ext = image.filename.rsplit(".", 1)[-1].lower()
        filename = f"{uuid.uuid4()}.{ext}"
        target_path = uploads_dir / filename
        target_path.write_bytes(content)
        image_url = f"/uploads/meals/{filename}"

        result = await run_in_threadpool(
            run_estimate,
            content,
            image.content_type,
            dish_hint=dish_hint,
            reference_object_type=reference_object_type,
            reference_bbox=parse_reference_bbox(reference_bbox),
            plate_diameter_cm=plate_diameter_cm,
        )
        result["image_url"] = image_url

        # Persist successful estimates as meal logs (twin over time)
        if result.get("status") == "estimated":
            db_meal = MealLog(
                user_id=user_id,
                dish_label=(result.get("dish") or {}).get("label"),
                carbs_g=result.get("carbs_g") or 0.0,
                protein_g=result.get("protein_g") or 0.0,
                fat_g=result.get("fat_g") or 0.0,
                fiber_g=result.get("fiber_g") or 0.0,
                image_url=image_url,
                logged_at=datetime.now(UTC),
                source="m5",
            )
            db.add(db_meal)
            await db.commit()
            await db.refresh(db_meal)
            result["id"] = db_meal.id
        return result
    except Exception as exc:
        log.exception("Error during nutrition estimation: %s", exc)
        raise
