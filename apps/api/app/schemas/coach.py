from datetime import datetime
from typing import Literal
import uuid
from pydantic import BaseModel, Field


class HiddenContext(BaseModel):
    last_meal_name: str | None = None
    last_meal_carbs_g: float | None = None
    last_meal_eaten_at: str | None = None   # ISO datetime string
    tir_percent: float | None = None         # 0–100
    latest_glucose_mgdl: float | None = None


class CoachMessageIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=350)
    language: Literal["en", "ur"] = "en"
    context_meal_id: uuid.UUID | None = None
    hidden_context: HiddenContext | None = None
    # chat_history is intentionally not accepted from the client;
    # history is loaded server-side from the DB to prevent prompt injection.


class MiniChart(BaseModel):
    kind: Literal["bar", "line", "compare"]
    series: list[dict]


class CoachReply(BaseModel):
    id: uuid.UUID
    text: str
    language: str
    safety_category: Literal[
        "ok",
        "refused_dosage",
        "refused_diagnosis",
        "refused_emergency",
        "refused_offtopic",
    ]
    refs: list[dict] = []
    mini_chart: MiniChart | None = None
    follow_ups: list[str] = []
    created_at: datetime
