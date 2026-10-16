from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class TrajectorySummaryPayload(BaseModel):
    peak_glucose_mg_dl: float
    time_to_peak_min: int
    iauc: float
    glucose_elevation_level: str = Field(default="normal")


class MealContextPayload(BaseModel):
    meal_name: str | None = None
    carbs_g: float | None = None
    protein_g: float | None = None
    fat_g: float | None = None
    fiber_g: float | None = None


class AICoachQuery(BaseModel):
    user_id: str = Field(default="", max_length=2000)
    query_text: str = Field(default="", max_length=2000)
    question: str | None = Field(default=None)
    language: str = Field(default="en", pattern="^(en|ur)$")
    trajectory_summary: TrajectorySummaryPayload | None = None
    meal_context: MealContextPayload | None = None

    @model_validator(mode="before")
    @classmethod
    def sync_query_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("query_text") and data.get("question"):
                data["query_text"] = data["question"]
            elif not data.get("question") and data.get("query_text"):
                data["question"] = data["query_text"]
        return data

    @model_validator(mode="after")
    def validate_query_not_empty(self) -> "AICoachQuery":
        if not self.query_text or not self.query_text.strip():
            raise ValueError("query_text or question must not be empty")
        return self


class AICoachResponse(BaseModel):
    response_text: str
    language: str
    sources_referenced: list[str] = Field(default_factory=list)
    safety_passed: bool
    disclaimer_included: bool
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
