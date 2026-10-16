from datetime import UTC, datetime

from pydantic import BaseModel, Field


class MealInput(BaseModel):
    carbohydrates_g: float = Field(ge=0.0)
    protein_g: float = Field(ge=0.0)
    fat_g: float = Field(ge=0.0)
    glycemic_index: float = Field(ge=0.0, le=100.0)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

class PostMealTrajectory(BaseModel):
    user_id: str
    meal_id: str
    time_minutes: list[int]
    glucose_values_mg_dl: list[float]
    peak_glucose_mg_dl: float
    time_to_peak_minutes: int
    confidence_interval_lower: list[float]
    confidence_interval_upper: list[float]
    model_version: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
