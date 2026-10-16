"""M3 physics core: 2-state glucose-insulin ODE integrated with RK45.

Honesty notes (Phase A rework, 2026-10-11):
- The forecast starts at the CURRENT glucose (start_glucose), not the
  patient's historical mean. Starting at the mean handed persistence an
  unfair information advantage and trained the residual on dynamics it
  was never evaluated on.
- T1D patients inject insulin. Bolus/fast doses enter an exogenous
  compartment that decays exponentially; clearance acts on total
  (endogenous + exogenous) insulin. The endogenous term is kept so the
  cold-start/no-dose path still behaves.
- Constants below are documented assumptions of a heuristic model, not
  fitted physiology. Per-patient (k_abs, S_i) come from ml.fit_patient.
"""
import numpy as np
from scipy.integrate import solve_ivp

BASAL_INSULIN = 10.0  # µU/mL, matches y0 in solve_trajectory

# Exogenous bolus compartment (mirrors ml.windows BOLUS_DECAY_PER_MIN).
BOLUS_DECAY_PER_MIN = 0.025   # ~28 min half-life, rapid-acting tail
# Coarse scale: 1 U of active bolus <-> this many µU/mL plasma-equivalent.
# Absorbed into per-patient S_i fitting; documented, not measured.
BOLUS_U_TO_MU_PER_ML = 15.0


def _bolus_active_mu_per_ml(t, bolus_doses):
    """Active exogenous insulin at minute t (µU/mL plasma-equivalent).

    bolus_doses: iterable of (offset_minutes_from_meal, units); doses with
    offset > t have not been delivered yet.
    """
    if not bolus_doses:
        return 0.0
    total = 0.0
    for t_dose, units in bolus_doses:
        if t >= t_dose:
            total += units * np.exp(-BOLUS_DECAY_PER_MIN * (t - t_dose))
    return BOLUS_U_TO_MU_PER_ML * total


def _glucose_insulin_derivatives(t, y, calibrated_state, meal_input, neural_residual_fn,
                                 activity_duration=0.0, activity_intensity=1.0,
                                 bolus_doses=None):
    G, I = y
    G_b = calibrated_state.baseline_glucose_mg_dl

    S_i = calibrated_state.estimated_insulin_sensitivity
    if activity_duration > 0 and 0 <= t <= activity_duration:
        S_i = S_i * (1.0 + 0.5 * activity_intensity)

    k_abs = calibrated_state.carb_absorption_rate_index

    D = meal_input.carbohydrates_g
    meal_appearance = (D * k_abs**2 * t * np.exp(-k_abs * t)) if t >= 0 else 0

    residual = neural_residual_fn(t, G, I)
    # Clearance acts on total insulin (endogenous + exogenous bolus) against
    # the excursion above baseline; basal endogenous production balances
    # clearance at (G_b, BASAL_INSULIN), so an unfed trajectory stays at
    # baseline instead of decaying to the floor.
    I_total = I + _bolus_active_mu_per_ml(t, bolus_doses)
    dG_dt = -S_i * I_total * (G - G_b) + meal_appearance + residual

    dI_dt = 0.01 * max(0, G - G_b) - 0.1 * (I - BASAL_INSULIN)

    return [dG_dt, dI_dt]


def solve_trajectory(calibrated_state, meal_input, neural_residual_fn,
                     horizon_minutes=120, activity_duration=0.0,
                     activity_intensity=1.0, start_glucose=None,
                     bolus_doses=None):
    """Integrate the post-meal trajectory on the 25-point 0..120 min grid.

    start_glucose: CGM at meal time; the forecast's initial condition.
        Defaults to the calibrated baseline (cold start / no live reading).
    bolus_doses: iterable of (offset_minutes_from_meal, units) feeding the
        exogenous insulin compartment. None = endogenous only.
    """
    t_span = (0, horizon_minutes)
    t_eval = np.linspace(0, horizon_minutes, 25)  # 25 points -> 0, 5, ..., 120

    y0 = [start_glucose if start_glucose is not None else calibrated_state.baseline_glucose_mg_dl,
          BASAL_INSULIN]

    sol = solve_ivp(
        fun=_glucose_insulin_derivatives,
        t_span=t_span,
        y0=y0,
        t_eval=t_eval,
        args=(calibrated_state, meal_input, neural_residual_fn,
              activity_duration, activity_intensity, bolus_doses),
        method='RK45'
    )

    glucose_values = np.clip(sol.y[0], a_min=20.0, a_max=600.0)
    return sol.t.tolist(), glucose_values.tolist()
