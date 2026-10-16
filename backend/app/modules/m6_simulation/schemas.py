from datetime import UTC, datetime

from pydantic import BaseModel, Field

from app.modules.m2_calibration.schemas import CalibratedState
from app.modules.m3_predictive_core.schemas import MealInput, PostMealTrajectory


class ActivityInput(BaseModel):
    name: str = "none"
    duration_minutes: float = Field(default=0.0, ge=0.0, le=120.0)
    intensity_factor: float = Field(default=1.0, ge=0.0, le=3.0)


class SimulationScenario(BaseModel):
    meal: MealInput
    activity: ActivityInput = Field(default_factory=ActivityInput)


class SimulationComparisonRequest(BaseModel):
    calibrated_state: CalibratedState
    baseline_scenario: SimulationScenario
    counterfactual_scenario: SimulationScenario

    def cache_key_dict(self) -> dict:
        """Deterministic cache-key payload.

        ``CalibratedState.calibration_timestamp`` and ``MealInput.timestamp``
        are server-side timestamps that change on every call; including them
        means two otherwise identical simulation requests never share a
        cache entry. Neither affects the simulated trajectories (the ODE
        only reads the nutrition values and physics parameters), so both
        are excluded here.
        """
        data = self.model_dump(mode="json")
        data["calibrated_state"].pop("calibration_timestamp", None)
        for scenario_key in ("baseline_scenario", "counterfactual_scenario"):
            scenario = data.get(scenario_key) or {}
            if isinstance(scenario.get("meal"), dict):
                scenario["meal"].pop("timestamp", None)
        return data


class TrajectoryMetrics(BaseModel):
    peak_glucose_mg_dl: float
    time_to_peak_minutes: int
    iauc_mg_dl_min: float


class SimulationDeltaMetrics(BaseModel):
    delta_peak_glucose_mg_dl: float = Field(
        description="Peak glucose change (counterfactual - baseline)"
    )
    delta_time_to_peak_minutes: int = Field(
        description="Peak time shift in minutes (counterfactual - baseline)"
    )
    delta_iauc_mg_dl_min: float = Field(
        description="Incremental AUC change in mg/dL*min (counterfactual - baseline)"
    )
    delta_tar_min: float = Field(
        default=0.0,
        description="Time above range change in minutes (counterfactual - baseline)",
    )



class SimulationComparisonResult(BaseModel):
    simulation_id: str
    user_id: str
    baseline_trajectory: PostMealTrajectory
    counterfactual_trajectory: PostMealTrajectory
    baseline_metrics: TrajectoryMetrics
    counterfactual_metrics: TrajectoryMetrics
    delta_metrics: SimulationDeltaMetrics
    summary_notes: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
