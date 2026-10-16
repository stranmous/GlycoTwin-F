
import numpy as np

from app.modules.m3_predictive_core.schemas import PostMealTrajectory
from app.modules.m6_simulation.schemas import (
    SimulationDeltaMetrics,
    TrajectoryMetrics,
)


def compute_iauc(time_minutes: list[int], glucose_values: list[float]) -> float:
    """Calculates Incremental Area Under Curve (iAUC) above starting baseline glucose.
    
    iAUC = integral_{0}^{T} max(0, G(t) - G(0)) dt
    using trapezoidal integration over time_minutes.
    """
    if not glucose_values or len(glucose_values) < 2:
        return 0.0
    
    baseline_g = glucose_values[0]
    incremental_g = [max(0.0, float(g - baseline_g)) for g in glucose_values]
    
    if hasattr(np, "trapezoid"):
        iauc_val = float(np.trapezoid(incremental_g, x=time_minutes))
    else:
        iauc_val = float(np.trapz(incremental_g, x=time_minutes))
        
    return round(iauc_val, 2)


def extract_metrics(trajectory: PostMealTrajectory) -> TrajectoryMetrics:
    """Extracts trajectory metrics: peak glucose, time to peak, and iAUC."""
    iauc = compute_iauc(trajectory.time_minutes, trajectory.glucose_values_mg_dl)
    return TrajectoryMetrics(
        peak_glucose_mg_dl=round(trajectory.peak_glucose_mg_dl, 2),
        time_to_peak_minutes=trajectory.time_to_peak_minutes,
        iauc_mg_dl_min=iauc,
    )


def compare_trajectories(
    baseline: PostMealTrajectory,
    counterfactual: PostMealTrajectory,
) -> tuple[TrajectoryMetrics, TrajectoryMetrics, SimulationDeltaMetrics]:
    """Computes comparative metrics and relative deltas between baseline and counterfactual trajectories."""
    baseline_metrics = extract_metrics(baseline)
    counterfactual_metrics = extract_metrics(counterfactual)
    
    delta_g_max = round(
        counterfactual_metrics.peak_glucose_mg_dl - baseline_metrics.peak_glucose_mg_dl,
        2,
    )
    delta_t_peak = counterfactual_metrics.time_to_peak_minutes - baseline_metrics.time_to_peak_minutes
    delta_iauc = round(
        counterfactual_metrics.iauc_mg_dl_min - baseline_metrics.iauc_mg_dl_min,
        2,
    )
    
    delta_metrics = SimulationDeltaMetrics(
        delta_peak_glucose_mg_dl=delta_g_max,
        delta_time_to_peak_minutes=delta_t_peak,
        delta_iauc_mg_dl_min=delta_iauc,
    )
    
    return baseline_metrics, counterfactual_metrics, delta_metrics
