from fastapi import APIRouter, Body, Depends

from app.core.security import get_current_user
from app.modules.m1_ingestion.schemas import IngestedUserData
from app.modules.m2_calibration.schemas import CalibratedState
from app.modules.m2_calibration.service import augment_trajectory, calibrate_user

router = APIRouter()


@router.get("/status")
def status() -> dict[str, str]:
    return {"module": "2", "name": "augmentation-and-calibration", "status": "active"}


@router.post("/calibrate", response_model=CalibratedState)
def calibrate_endpoint(user_data: IngestedUserData,
                       user_id: str = Depends(get_current_user)):
    return calibrate_user(user_data, fit_physics=True)


@router.post("/augment/{user_id}")
def augment_endpoint(user_data: IngestedUserData,
                     meal_carbs_g: float = Body(..., embed=True),
                     auth_user: str = Depends(get_current_user)):
    state = calibrate_user(user_data, fit_physics=True)
    trajectory = augment_trajectory(state, meal_carbs_g)
    return {"user_id": user_data.user_id, "trajectory": trajectory}

