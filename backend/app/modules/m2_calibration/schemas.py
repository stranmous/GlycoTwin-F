from datetime import UTC, datetime

from pydantic import BaseModel, Field


class CalibratedState(BaseModel):
    user_id: str
    phenotype_cluster_id: str
    baseline_glucose_mg_dl: float = Field(ge=20.0, le=600.0)
    estimated_insulin_sensitivity: float = Field(ge=0.0)
    carb_absorption_rate_index: float = Field(ge=0.0)
    confidence_score: float = Field(ge=0.0, le=1.0)
    calibration_timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    is_cold_start: bool
    # Honest provenance of (estimated_insulin_sensitivity,
    # carb_absorption_rate_index): "demographic_default" = rule-based
    # phenotype defaults (no data fit); "least_squares_fit" = grid fit on
    # the user's own meal windows (see parameter_fit.py).
    estimation_method: str = Field(default="demographic_default")
    n_fit_windows: int = Field(default=0, ge=0)
