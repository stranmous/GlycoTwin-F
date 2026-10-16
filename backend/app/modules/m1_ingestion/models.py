from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.m1_ingestion.schemas import (
    CGMReadingPayload,
    IngestedUserData,
    MealRecordPayload,
    UserProfilePayload,
)


class GlucoseObservation(BaseModel):
    timestamp: datetime
    glucose_mg_dl: float = Field(..., ge=20.0, le=600.0)
    source: str = Field(min_length=1)


class NormalizedUserRecord(BaseModel):
    user_id: str = Field(min_length=1)
    observations: list[GlucoseObservation] = Field(default_factory=list)
    meal_carbohydrates_g: float | None = Field(default=None, ge=0)
    activity_minutes: float | None = Field(default=None, ge=0)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)


__all__ = [
    "CGMReadingPayload",
    "GlucoseObservation",
    "IngestedUserData",
    "MealRecordPayload",
    "NormalizedUserRecord",
    "UserProfilePayload",
]


