"""M3 serving path (Phase A rework).

- The forecast starts at the caller's current glucose (start_glucose),
  falling back to the calibrated baseline for cold start.
- With no trained residual configured, the service runs pure physics
  (ZeroResidual) — the sine-wave placeholder no longer serves.
- The confidence band is EMPIRICAL: per-horizon 10th/90th percentiles of
  (actual - physics prediction) residuals measured on held-out validation
  windows (see data/ci_band.json). It is not a calibrated predictive
  interval and is labelled as such.
"""
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings
from app.core.logging import get_logger
from app.modules.m2_calibration.schemas import CalibratedState
from app.modules.m3_predictive_core.neural_residual import (
    TrainedResidual,
    ZeroResidual,
)
from app.modules.m3_predictive_core.ode_solver import solve_trajectory
from app.modules.m3_predictive_core.schemas import MealInput, PostMealTrajectory

log = get_logger("glycotwin.m3")

_CI_BAND_PATH = Path(__file__).resolve().parent / "data" / "ci_band.json"


def _load_ci_band() -> dict[str, list[float]] | None:
    """Per-horizon [q10, q90] residual quantiles, or None if not built yet."""
    try:
        band = json.loads(_CI_BAND_PATH.read_text())
        return {str(k): [float(v[0]), float(v[1])] for k, v in band["horizons"].items()}
    except (OSError, ValueError, KeyError) as exc:
        log.warning("empirical CI band unavailable (%s); band disabled", exc)
        return None


def _select_residual():
    """Trained residual when configured and loadable; pure physics otherwise.

    The fallback is deliberate and loud: a misconfigured production deploy
    degrades to physics-only instead of crashing predictions.
    """
    weights = get_settings().m3_residual_weights
    if weights:
        try:
            model = TrainedResidual(weights)
            log.info("M3 serving trained residual from %s", weights)
            return model
        except (OSError, RuntimeError, ImportError) as exc:
            log.warning("trained residual unavailable (%s); using physics-only", exc)
    return ZeroResidual()


_residual_model = None
_ci_band: dict[str, list[float]] | None = None
_ci_band_loaded = False


def get_residual_model():
    """Build the residual on first use — importing this module must not read
    model weights from disk."""
    global _residual_model
    if _residual_model is None:
        _residual_model = _select_residual()
    return _residual_model


def get_ci_band() -> dict[str, list[float]] | None:
    """Load the empirical band on first use (None stays None once checked)."""
    global _ci_band, _ci_band_loaded
    if not _ci_band_loaded:
        _ci_band = _load_ci_band()
        _ci_band_loaded = True
    return _ci_band


def empirical_band(glucose_values: list[float],
                   time_minutes: list[float]) -> tuple[list[float], list[float]]:
    """Empirical 80% band from held-out residual quantiles.

    For each horizon, lower = pred + q10(residual), upper = pred + q90.
    Documented as empirical: it describes past errors, not a calibrated
    interval for this patient.
    """
    lower, upper = [], []
    band = get_ci_band()
    for t, g in zip(time_minutes, glucose_values):
        if band is not None:
            q10, q90 = band.get(str(int(t)), band.get("120", [0.0, 0.0]))
        else:
            q10, q90 = 0.0, 0.0
        lower.append(max(20.0, g + q10))
        upper.append(min(600.0, g + q90))
    return lower, upper


def generate_trajectory(
    calibrated_state: CalibratedState,
    meal_input: MealInput,
    current_glucose_mg_dl: float | None = None,
    activity_duration: float = 0.0,
    activity_intensity: float = 1.0,
) -> PostMealTrajectory:
    time_minutes, glucose_values = solve_trajectory(
        calibrated_state,
        meal_input,
        neural_residual_fn=get_residual_model().evaluate,
        activity_duration=activity_duration,
        activity_intensity=activity_intensity,
        start_glucose=current_glucose_mg_dl,
    )

    lower_ci, upper_ci = empirical_band(glucose_values, time_minutes)

    peak_glucose = max(glucose_values)
    peak_idx = glucose_values.index(peak_glucose)
    time_to_peak = int(time_minutes[peak_idx])

    return PostMealTrajectory(
        user_id=calibrated_state.user_id,
        meal_id=str(uuid4()),
        time_minutes=[int(t) for t in time_minutes],
        glucose_values_mg_dl=glucose_values,
        peak_glucose_mg_dl=peak_glucose,
        time_to_peak_minutes=time_to_peak,
        confidence_interval_lower=lower_ci,
        confidence_interval_upper=upper_ci,
        model_version=get_residual_model().model_version,
        created_at=datetime.now(UTC)
    )
