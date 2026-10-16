"""M7 API schemas. Readings accept CGM exports or M3 trajectory points."""
from pydantic import BaseModel, Field, model_validator


class GlucoseReading(BaseModel):
    glucose_mg_dl: float = Field(ge=20, le=600)
    t_min: float | None = None  # minutes from series start, when known


class TimeInRangeRequest(BaseModel):
    readings: list[GlucoseReading] = Field(min_length=1, max_length=100_000)
    low: float = Field(default=70.0, ge=20, le=300)
    high: float = Field(default=180.0, ge=50, le=400)

    @model_validator(mode="after")
    def _ordered(self) -> "TimeInRangeRequest":
        if self.low >= self.high:
            raise ValueError("low must be below high")
        return self


class TimeInRangeResponse(BaseModel):
    n: int
    sample_count: int = Field(default=0)
    low: float
    high: float
    below_count: int
    in_range_count: int
    above_count: int
    below_pct: float
    in_range_pct: float
    above_pct: float
    mean_mg_dl: float
    sd_mg_dl: float
    cv_pct: float
    gmi_pct: float

    @model_validator(mode="after")
    def _sync_sample_count(self) -> "TimeInRangeResponse":
        if self.sample_count == 0 and self.n > 0:
            self.sample_count = self.n
        return self


class TirSummary(BaseModel):
    in_range_pct: float
    above_range_pct: float
    below_range_pct: float
    sample_count: int
    mean_mg_dl: float = 118.0
    gmi_pct: float = 6.1


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
    severity: str = "info"


class InsightsSummaryResponse(BaseModel):
    window: str
    tir: TirSummary
    avg_peak_by_meal_type: dict[str, float]
    top_spike_meals: list[SpikeMeal]
    cards: list[InsightCard]

