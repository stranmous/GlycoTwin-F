"""M2 parameter estimation: least-squares fit of the physics ODE parameters.

Fits (k_abs, S_i) to the user's own meal history by grid search minimizing
the RMSE of the physics ODE against those windows' actual CGM — the same
grid the offline benchmark uses (backend/ml/fit_patient.py), so serving
estimates are comparable to benchmarked numbers.

This replaced the old if/else "adaptive filter", which multiplied
parameters by fixed constants from average glucose and was not estimation
of any kind. Nothing here is Bayesian or Kalman; the state's
estimation_method label says exactly what ran.

Earlier-data rule: service.calibrate_user restricts the history to events
strictly before its `before` cutoff; each window's baseline is additionally
computed from data strictly before that window's meal, so a window never
calibrates itself.
"""
from __future__ import annotations

import math
from datetime import datetime

from app.core.logging import get_logger
from app.modules.m1_ingestion.schemas import IngestedUserData
from app.modules.m2_calibration.phenotype import assign_phenotype
from app.modules.m2_calibration.schemas import CalibratedState
from app.modules.m3_predictive_core.ode_solver import solve_trajectory
from app.modules.m3_predictive_core.schemas import MealInput
from ml.metrics import rmse
from ml.windows import extract_windows

log = get_logger("glycotwin.m2")

# Grid ported from backend/ml/fit_patient.py — keep in sync; serving and the
# benchmark must search the same space for the numbers to be comparable.
K_ABS_GRID = [0.015, 0.03, 0.06, 0.10, 0.16, 0.25]
S_I_GRID = [0.0001, 0.0002, 0.0004, 0.0008, 0.0015, 0.003]
MAX_FIT_WINDOWS = 40
MIN_FIT_WINDOWS = 3


def _restrict(user_data: IngestedUserData, before: datetime) -> IngestedUserData:
    """History strictly before `before`.

    Local copy of the cutoff (service.py has its own for the top-level
    cutoff) — kept separate to avoid a circular import.
    """
    return user_data.model_copy(update={
        "cgm_readings": [r for r in user_data.cgm_readings if r.timestamp < before],
        "meal_records": [m for m in user_data.meal_records if m.timestamp < before],
        "insulin_doses": [d for d in user_data.insulin_doses if d.timestamp < before],
    })


def _window_rmse(windows: list, user_data: IngestedUserData,
                 k_abs: float, s_i: float) -> float:
    """RMSE of the physics ODE (candidate params) over the given windows."""
    pairs = []
    for w in windows:
        if w.meal_time is None:
            continue
        # Baseline from data strictly before this meal — the window never
        # calibrates itself. assign_phenotype (not calibrate_user) so the
        # fit cannot recurse into itself.
        base = assign_phenotype(_restrict(user_data, w.meal_time))
        base = base.model_copy(update={
            "carb_absorption_rate_index": k_abs,
            "estimated_insulin_sensitivity": s_i,
        })
        meal = MealInput(carbohydrates_g=w.carbs_g, protein_g=w.protein_g,
                         fat_g=w.fat_g, glycemic_index=70.0)
        _, pred = solve_trajectory(base, meal, neural_residual_fn=lambda *_: 0.0,
                                   start_glucose=w.start_glucose,
                                   bolus_doses=w.bolus_doses)
        pairs += list(zip(w.actual, pred))
    return rmse(pairs)


def fit_physics_parameters(state: CalibratedState,
                           user_data: IngestedUserData) -> CalibratedState:
    """Least-squares (k_abs, S_i) grid fit on the user's meal windows.

    Returns the state with fitted parameters and
    estimation_method="least_squares_fit". With fewer than MIN_FIT_WINDOWS
    usable windows — or if the fit fails — falls back to the demographic
    defaults and labels the state honestly instead of inventing a fit.
    """
    try:
        windows = extract_windows(user_data)
    except Exception as exc:  # noqa: BLE001 -- any extraction failure means
        # no trustworthy windows; fall back to labelled defaults, never crash
        log.warning("window extraction failed (%s); using demographic defaults", exc)
        windows = []
    if len(windows) < MIN_FIT_WINDOWS:
        return state.model_copy(update={
            "estimation_method": "demographic_default",
            "n_fit_windows": len(windows),
        })
    try:
        # Deterministic strided subsample keeps the serving fit to
        # <= 36 grid points x 40 windows (about 2 s worst case).
        step = max(1, math.ceil(len(windows) / MAX_FIT_WINDOWS))
        sub = windows[::step]
        best = None
        for k_abs in K_ABS_GRID:
            for s_i in S_I_GRID:
                err = _window_rmse(sub, user_data, k_abs, s_i)
                if best is None or err < best[0]:
                    best = (err, k_abs, s_i)
        _, k_abs, s_i = best
    except Exception as exc:  # noqa: BLE001 -- any fit failure (solver,
        # data, numeric) falls back to labelled defaults, never a fake fit
        log.warning("least-squares fit failed (%s); using demographic defaults", exc)
        return state.model_copy(update={
            "estimation_method": "demographic_default",
            "n_fit_windows": 0,
        })
    return state.model_copy(update={
        "carb_absorption_rate_index": k_abs,
        "estimated_insulin_sensitivity": s_i,
        "estimation_method": "least_squares_fit",
        "n_fit_windows": len(windows),
    })
