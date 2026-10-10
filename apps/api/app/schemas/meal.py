from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict


class DetectedFoodIn(BaseModel):
    name_en: str
    name_ur: str | None = None
    portion_g: float = 0.0
    carbs_g: float = 0.0
    kcal: float = 0.0
    confidence: float = 0.0


class DetectedFoodOut(DetectedFoodIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class MealIn(BaseModel):
    eaten_at: datetime | None = None
    meal_type: str | None = None
    note: str | None = None
    detected_foods: list[DetectedFoodIn]
    user_edited: bool = False


class MealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    image_url: str | None = None
    eaten_at: datetime
    meal_type: str | None = None
    total_carbs_g: float
    total_kcal: float
    confidence: float
    user_edited: bool
    note: str | None = None
    detected_foods: list[DetectedFoodOut]
    created_at: datetime
