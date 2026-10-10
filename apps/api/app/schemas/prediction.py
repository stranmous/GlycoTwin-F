from datetime import datetime
from typing import Literal
import uuid
from pydantic import BaseModel


class GlucosePoint(BaseModel):
    t_min: float
    mgdl: float


class PredictionIn(BaseModel):
    meal_id: uuid.UUID


class PredictionOut(BaseModel):
    id: uuid.UUID
    meal_id: uuid.UUID
    curve: list[GlucosePoint]
    peak_mgdl: float
    peak_at_min: float
    time_above_range_min: float
    created_at: datetime


class SimulationInputs(BaseModel):
    portion_scale: float = 1.0  # 0.25 .. 1.5
    walk_minutes: int = 0  # 0 .. 60
    intensity: Literal["light", "moderate"] = "light"
    timing_offset_min: int = 0  # 0 / 30 / 60


class SimulationIn(BaseModel):
    meal_id: uuid.UUID
    inputs: SimulationInputs


class SimulationOut(BaseModel):
    id: uuid.UUID
    meal_id: uuid.UUID
    inputs: SimulationInputs
    baseline_curve: list[GlucosePoint]
    simulated_curve: list[GlucosePoint]
    delta_peak_mgdl: float
    delta_tar_min: float
