from datetime import UTC, datetime

from app.modules.m1_ingestion.schemas import IngestedUserData
from app.modules.m2_calibration.schemas import CalibratedState


def assign_phenotype(user_data: IngestedUserData) -> CalibratedState:
    """Assigns demographic defaults and baseline physiological parameters.

    NOTE ON NAMING: `phenotype_cluster_id` values like "cluster_high_bmi"
    are rule-based BMI buckets, not data-derived clusters — no clustering
    algorithm was ever run on patient data. They select demographic default
    parameters; real per-patient estimation happens in parameter_fit.py
    (least-squares grid fit) once enough meal history exists. The state's
    estimation_method field tells callers which of the two produced the
    numbers.
    """
    # Define cold start as having fewer than 3 days of CGM data (288 readings/day)
    is_cold_start = len(user_data.cgm_readings) < (288 * 3)

    # Default physiological parameters.
    # UNITS (unified with M3, 2026-10-10): insulin_sensitivity is expressed in
    # the predictive core's ODE units, dG/dt = -S_i * I * (G - G_baseline).
    # With basal insulin I ~= 10, S_i = 0.001-0.003 gives an effective glucose
    # clearance of ~0.01-0.03/min. (The original constants 0.03-0.07 were on
    # this module's own augmentation scale and crashed M3 curves into the
    # 20 mg/dL floor; see docs/DESIGN.md fix log.)
    phenotype_cluster_id = "cluster_default"
    baseline_glucose = 95.0
    insulin_sensitivity = 0.002
    carb_absorption = 0.1
    confidence = 0.5

    if user_data.user_profile:
        bmi = user_data.user_profile.bmi
        if bmi:
            if bmi > 30:
                phenotype_cluster_id = "cluster_high_bmi"
                baseline_glucose = 110.0
                insulin_sensitivity = 0.001
                confidence = 0.8
            elif bmi < 18.5:
                phenotype_cluster_id = "cluster_low_bmi"
                baseline_glucose = 85.0
                insulin_sensitivity = 0.003
                confidence = 0.8
            else:
                phenotype_cluster_id = "cluster_normal_bmi"
                baseline_glucose = 95.0
                insulin_sensitivity = 0.002
                confidence = 0.8
                
        # Adjust if explicitly defined in user profile
        if user_data.user_profile.baseline_insulin_sensitivity:
            insulin_sensitivity = user_data.user_profile.baseline_insulin_sensitivity
            confidence = 0.9

    # If not a cold start, we could theoretically calculate actual baseline from CGM history
    if not is_cold_start and len(user_data.cgm_readings) > 0:
        avg_glucose = sum(r.glucose_mg_dl for r in user_data.cgm_readings) / len(user_data.cgm_readings)
        baseline_glucose = max(20.0, min(600.0, avg_glucose))
        confidence = 0.95

    return CalibratedState(
        user_id=user_data.user_id,
        phenotype_cluster_id=phenotype_cluster_id,
        baseline_glucose_mg_dl=baseline_glucose,
        estimated_insulin_sensitivity=insulin_sensitivity,
        carb_absorption_rate_index=carb_absorption,
        confidence_score=confidence,
        calibration_timestamp=datetime.now(UTC),
        is_cold_start=is_cold_start
    )
