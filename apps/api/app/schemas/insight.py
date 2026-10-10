from typing import Literal
from pydantic import BaseModel


class TirSummary(BaseModel):
    in_range_pct: float
    above_range_pct: float
    below_range_pct: float
    sample_count: int


class SpikeMeal(BaseModel):
    meal_id: str
    label: str
    peak_mgdl: float


class InsightCard(BaseModel):
    id: str
    title_en: str
    title_ur: str | None = None
    body_en: str
    body_ur: str | None = None
    severity: Literal["info", "good", "warn"] = "info"


class InsightsSummary(BaseModel):
    window: Literal["today", "7d", "30d"]
    tir: TirSummary
    avg_peak_by_meal_type: dict[str, float]
    top_spike_meals: list[SpikeMeal]
    cards: list[InsightCard]
