from datetime import UTC, datetime
from uuid import uuid4

from app.modules.m3_predictive_core.service import generate_trajectory
from app.modules.m6_simulation.comparator import compare_trajectories
from app.modules.m6_simulation.schemas import (
    SimulationComparisonRequest,
    SimulationComparisonResult,
)


def run_counterfactual_simulation(
    request: SimulationComparisonRequest,
) -> SimulationComparisonResult:
    """Executes baseline vs counterfactual meal/activity simulation using Module 3 trajectory engine."""
    # Generate baseline trajectory
    baseline_trajectory = generate_trajectory(
        calibrated_state=request.calibrated_state,
        meal_input=request.baseline_scenario.meal,
        activity_duration=request.baseline_scenario.activity.duration_minutes,
        activity_intensity=request.baseline_scenario.activity.intensity_factor,
    )
    
    # Generate counterfactual trajectory
    counterfactual_trajectory = generate_trajectory(
        calibrated_state=request.calibrated_state,
        meal_input=request.counterfactual_scenario.meal,
        activity_duration=request.counterfactual_scenario.activity.duration_minutes,
        activity_intensity=request.counterfactual_scenario.activity.intensity_factor,
    )
    
    # Compute comparative metrics
    baseline_metrics, counterfactual_metrics, delta_metrics = compare_trajectories(
        baseline=baseline_trajectory,
        counterfactual=counterfactual_trajectory,
    )
    
    # Build summary note
    summary_parts = []
    if delta_metrics.delta_peak_glucose_mg_dl < 0:
        summary_parts.append(f"Peak glucose reduced by {abs(delta_metrics.delta_peak_glucose_mg_dl):.1f} mg/dL.")
    elif delta_metrics.delta_peak_glucose_mg_dl > 0:
        summary_parts.append(f"Peak glucose increased by {delta_metrics.delta_peak_glucose_mg_dl:.1f} mg/dL.")
    else:
        summary_parts.append("Peak glucose unchanged.")
        
    if delta_metrics.delta_iauc_mg_dl_min < 0:
        summary_parts.append(f"Incremental AUC decreased by {abs(delta_metrics.delta_iauc_mg_dl_min):.1f} mg/dL*min.")
    elif delta_metrics.delta_iauc_mg_dl_min > 0:
        summary_parts.append(f"Incremental AUC increased by {delta_metrics.delta_iauc_mg_dl_min:.1f} mg/dL*min.")
        
    summary_notes = " ".join(summary_parts)
    
    return SimulationComparisonResult(
        simulation_id=str(uuid4()),
        user_id=request.calibrated_state.user_id,
        baseline_trajectory=baseline_trajectory,
        counterfactual_trajectory=counterfactual_trajectory,
        baseline_metrics=baseline_metrics,
        counterfactual_metrics=counterfactual_metrics,
        delta_metrics=delta_metrics,
        summary_notes=summary_notes,
        created_at=datetime.now(UTC),
    )
