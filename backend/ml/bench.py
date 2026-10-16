"""Shared Phase-A benchmark machinery.

Protocol (the earlier-data rule, everywhere):
- Forecasts start at the meal-time CGM (start_glucose), never the history mean.
- Calibration uses only data strictly before each meal (before=meal_time).
- Per-patient (k_abs, S_i) are fitted on TRAIN patients only; the held-out
  patient uses the population median. No future data anywhere.
- Baselines: persistence, ridge regression, persistence + mean meal response.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from app.modules.m1_ingestion.loaders.d1namo_loader import D1NAMOLoader
from app.modules.m2_calibration.service import calibrate_user
from app.modules.m3_predictive_core.ode_solver import solve_trajectory
from app.modules.m3_predictive_core.schemas import MealInput
from ml.fit_patient import fit_patient, population_median
from ml.metrics import clarke_summary, horizon_metrics, mae, rmse
from ml.windows import GRID_MIN, MealWindow, extract_windows


def load_patient(data_dir: Path, pid: str, diabetic_type: str = "type_1"):
    """(IngestedUserData, windows) with insulin doses when present."""
    sub = data_dir / pid
    ins = sub / "insulin.csv"
    user = D1NAMOLoader.load_csv(
        sub / "cgm.csv", sub / "meals.csv", user_id=pid,
        insulin_source=ins if ins.exists() else None,
        diabetic_type=diabetic_type)
    return user, extract_windows(user)


def state_for(user, window: MealWindow, k_abs: float, s_i: float):
    """Per-window calibrated state with fitted physics params."""
    state = calibrate_user(user, before=window.meal_time)
    return state.model_copy(update={
        "carb_absorption_rate_index": k_abs,
        "estimated_insulin_sensitivity": s_i,
    })


def physics_predict(window: MealWindow, user, k_abs: float, s_i: float,
                    residual_fn=None) -> list[float]:
    state = state_for(user, window, k_abs, s_i)
    meal = MealInput(carbohydrates_g=window.carbs_g, protein_g=window.protein_g,
                     fat_g=window.fat_g, glycemic_index=70.0)
    _, pred = solve_trajectory(
        state, meal,
        neural_residual_fn=residual_fn or (lambda *_: 0.0),
        start_glucose=window.start_glucose,
        bolus_doses=window.bolus_doses)
    return pred


def fit_params_for_fold(patient_data: dict, train_ids: list[str]):
    """{pid: fitted params} on train patients; returns (fitted, median)."""
    fitted = {}
    for pid in train_ids:
        user, windows = patient_data[pid]
        if windows:
            fitted[pid] = fit_patient(user, windows)
    return fitted, population_median(fitted)


def params_for(fitted: dict, median: dict, pid: str) -> tuple[float, float]:
    p = fitted.get(pid, median)
    return p["k_abs"], p["S_i"]


# ---------------- baselines ----------------

def _ridge_features(windows: list[MealWindow]) -> np.ndarray:
    return np.array([[w.start_glucose, w.carbs_g,
                      w.trend_30min if w.trend_30min is not None else 0.0]
                     for w in windows])


def fit_ridge(train_windows: list[MealWindow]):
    X = _ridge_features(train_windows)
    y = np.array([w.actual for w in train_windows])
    scaler = StandardScaler().fit(X)
    model = Ridge(alpha=1.0).fit(scaler.transform(X), y)
    return model, scaler


def ridge_predict(model, scaler, window: MealWindow) -> list[float]:
    x = _ridge_features([window])
    return model.predict(scaler.transform(x))[0].tolist()


def fit_mean_response(train_windows: list[MealWindow]) -> list[float]:
    """Mean (actual - start_glucose) excursion per grid point on train data."""
    n = len(GRID_MIN)
    acc = [0.0] * n
    for w in train_windows:
        for i, a in enumerate(w.actual):
            acc[i] += a - w.start_glucose
    m = len(train_windows) or 1
    return [v / m for v in acc]


# ---------------- statistics ----------------

def per_patient_rmse(pairs_by_patient: dict[str, dict[str, list]]):
    """{pid: {model: rmse}} from {pid: {model: [(ref, pred), ...]}}.

    Patients with no windows (no meals) are skipped."""
    out = {}
    for pid, models in pairs_by_patient.items():
        row = {model: round(rmse(pairs), 2) for model, pairs in models.items()
               if pairs}
        if row:
            out[pid] = row
    return out


def bootstrap_patient_ci(per_patient: dict[str, dict[str, float]],
                         n_resamples: int = 1000, seed: int = 0):
    """Patient-level bootstrap 95% CI of mean RMSE per model.

    Resamples patients with replacement; each resample's statistic is the
    mean of per-patient RMSEs. With 6-7 patients the intervals are wide —
    reported as-is, not smoothed.
    """
    import random
    rng = random.Random(seed)
    models = sorted({m for d in per_patient.values() for m in d})
    cis = {}
    for model in models:
        vals = [d[model] for d in per_patient.values() if model in d]
        if not vals:
            continue
        boots = []
        for _ in range(n_resamples):
            sample = [rng.choice(vals) for _ in vals]
            boots.append(sum(sample) / len(sample))
        boots.sort()
        lo = boots[int(0.025 * n_resamples)]
        hi = boots[int(0.975 * n_resamples)]
        cis[model] = [round(lo, 2), round(hi, 2)]
    return cis


def model_summary(pairs: list[tuple[float, float]],
                  curves: list[tuple[list[float], list[float]]]) -> dict:
    return {
        "overall_rmse": round(rmse(pairs), 2),
        "overall_mae": round(mae(pairs), 2),
        "horizons": horizon_metrics(curves),
        "clarke_pct": clarke_summary(pairs),
        "n_points": len(pairs),
    }


def residual_quantiles_by_horizon(residuals_by_horizon: dict[int, list[float]],
                                  q10: float = 10.0, q90: float = 90.0) -> dict:
    """{horizon_min: [q10, q90]} of (actual - predicted) residuals."""
    out = {}
    for h in GRID_MIN:
        vals = sorted(residuals_by_horizon.get(h, []))
        if not vals:
            out[str(h)] = [0.0, 0.0]
            continue
        def pct(p, _vals=vals):
            k = (len(_vals) - 1) * p / 100.0
            f, c = math.floor(k), math.ceil(k)
            return _vals[f] if f == c else _vals[f] + (_vals[c] - _vals[f]) * (k - f)
        out[str(h)] = [round(pct(q10), 2), round(pct(q90), 2)]
    return out
