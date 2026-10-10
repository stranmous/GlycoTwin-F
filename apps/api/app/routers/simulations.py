from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.firebase import CurrentUser
from app.models.meal import Meal
from app.models.simulation import Simulation
from app.schemas.prediction import GlucosePoint, SimulationIn, SimulationOut
from app.services.glucose_model import baseline_curve, simulated_curve, summarize

router = APIRouter(prefix="/v1/simulations", tags=["simulations"])


@router.post("/what-if", response_model=SimulationOut)
async def create_what_if(
    payload: SimulationIn,
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

    base = baseline_curve(meal.total_carbs_g, user.weight_kg)
    sim = simulated_curve(
        carbs_g=meal.total_carbs_g,
        weight_kg=user.weight_kg,
        portion_scale=payload.inputs.portion_scale,
        walk_minutes=payload.inputs.walk_minutes,
        intensity=payload.inputs.intensity,
        timing_offset_min=payload.inputs.timing_offset_min,
    )
    base_peak, _, base_tar = summarize(base)
    sim_peak, _, sim_tar = summarize(sim)

    record = Simulation(
        user_id=user.id,
        meal_id=meal.id,
        inputs=payload.inputs.model_dump(),
        baseline_curve=[{"t_min": p.t_min, "mgdl": p.mgdl} for p in base],
        simulated_curve=[{"t_min": p.t_min, "mgdl": p.mgdl} for p in sim],
        delta_peak_mgdl=round(sim_peak - base_peak, 1),
        delta_tar_min=round(sim_tar - base_tar, 1),
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    return SimulationOut(
        id=record.id,
        meal_id=record.meal_id,
        inputs=payload.inputs,
        baseline_curve=[GlucosePoint(**p) for p in record.baseline_curve],
        simulated_curve=[GlucosePoint(**p) for p in record.simulated_curve],
        delta_peak_mgdl=record.delta_peak_mgdl,
        delta_tar_min=record.delta_tar_min,
    )
