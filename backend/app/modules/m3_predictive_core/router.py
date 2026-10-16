from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.modules.m1_ingestion.db_models import CalibrationSnapshot
from app.modules.m2_calibration.schemas import CalibratedState
from app.modules.m3_predictive_core.schemas import MealInput, PostMealTrajectory
from app.modules.m3_predictive_core.service import generate_trajectory

router = APIRouter()

class PredictionRequest(BaseModel):
    calibrated_state: CalibratedState
    meal_input: MealInput
    current_glucose_mg_dl: float | None = Field(
        default=None, ge=20.0, le=600.0,
        description="CGM at meal time; the forecast's initial condition. "
                    "Defaults to the calibrated baseline (cold start).")

@router.post("/predict", response_model=PostMealTrajectory)
async def predict(request: PredictionRequest,
                  user_id: str = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    trajectory = generate_trajectory(
        request.calibrated_state, request.meal_input,
        current_glucose_mg_dl=request.current_glucose_mg_dl)
    # Snapshot the calibration that produced this forecast (reproducibility)
    state = request.calibrated_state
    db.add(CalibrationSnapshot(
        user_id=user_id,
        phenotype_cluster_id=state.phenotype_cluster_id,
        baseline_glucose_mg_dl=state.baseline_glucose_mg_dl,
        estimated_insulin_sensitivity=state.estimated_insulin_sensitivity,
        carb_absorption_rate_index=state.carb_absorption_rate_index,
        confidence_score=state.confidence_score,
        is_cold_start=state.is_cold_start,
    ))
    await db.commit()
    return trajectory

@router.get("/status")
def status() -> dict[str, str]:
    return {"module": "3", "name": "hybrid-neural-ode-predictive-core", "status": "active"}
