"""Per-patient physics fit for M3 (Phase A).

Fits (k_abs, S_i) per patient by small grid search on that patient's TRAIN
windows only — the earlier-data rule: a held-out patient's windows never
enter any fit. Held-out patients use the population median of the fitted
training patients.

Runtime: grid of 5 x 5 combos, at most 40 windows per patient, one scipy
ODE solve per (combo, window). ~1000 solves per patient, seconds each.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from app.modules.m2_calibration.service import calibrate_user
from app.modules.m3_predictive_core.ode_solver import solve_trajectory
from app.modules.m3_predictive_core.schemas import MealInput
from ml.metrics import rmse
from ml.windows import MealWindow

K_ABS_GRID = [0.015, 0.03, 0.06, 0.10, 0.16, 0.25]
S_I_GRID = [0.0001, 0.0002, 0.0004, 0.0008, 0.0015, 0.003]
MAX_FIT_WINDOWS = 40


def _window_rmse(windows: list[MealWindow], user, k_abs: float, s_i: float) -> float:
    pairs = []
    for w in windows:
        state = calibrate_user(user, before=w.meal_time)
        state = state.model_copy(update={
            "carb_absorption_rate_index": k_abs,
            "estimated_insulin_sensitivity": s_i,
        })
        meal = MealInput(carbohydrates_g=w.carbs_g, protein_g=w.protein_g,
                         fat_g=w.fat_g, glycemic_index=70.0)
        _, pred = solve_trajectory(state, meal, neural_residual_fn=lambda *_: 0.0,
                                   start_glucose=w.start_glucose,
                                   bolus_doses=w.bolus_doses)
        pairs += list(zip(w.actual, pred))
    return rmse(pairs)


def fit_patient(user, windows: list[MealWindow]) -> dict:
    """Grid-search (k_abs, S_i) on this patient's own windows. Returns params."""
    if not windows:
        raise ValueError("no windows to fit")
    # deterministic strided subsample keeps runtime sane on 200+ window patients
    step = max(1, math.ceil(len(windows) / MAX_FIT_WINDOWS))
    sub = windows[::step]
    best = None
    for k_abs in K_ABS_GRID:
        for s_i in S_I_GRID:
            err = _window_rmse(sub, user, k_abs, s_i)
            if best is None or err < best[0]:
                best = (err, k_abs, s_i)
    err, k_abs, s_i = best
    return {"k_abs": k_abs, "S_i": s_i, "train_rmse": round(err, 2),
            "n_windows": len(windows), "n_fit_windows": len(sub)}


def population_median(fitted: dict[str, dict]) -> dict:
    """Median params across fitted patients — the no-leak fallback for
    held-out patients."""
    import statistics
    return {
        "k_abs": statistics.median(p["k_abs"] for p in fitted.values()),
        "S_i": statistics.median(p["S_i"] for p in fitted.values()),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, required=True)
    ap.add_argument("--train-ids", nargs="+", required=True)
    ap.add_argument("--reports", type=Path, default=Path("ml/reports"))
    args = ap.parse_args()

    from app.modules.m1_ingestion.loaders.d1namo_loader import D1NAMOLoader
    from ml.windows import extract_windows

    out = {}
    for pid in args.train_ids:
        sub = args.data_dir / pid
        ins = sub / "insulin.csv"
        user = D1NAMOLoader.load_csv(sub / "cgm.csv", sub / "meals.csv", user_id=pid,
                                     insulin_source=ins if ins.exists() else None)
        windows = extract_windows(user)
        if not windows:
            print(f"{pid}: no windows, skipped")
            continue
        out[pid] = fit_patient(user, windows)
        print(f"{pid}: k_abs={out[pid]['k_abs']} S_i={out[pid]['S_i']} "
              f"rmse={out[pid]['train_rmse']}")
    args.reports.mkdir(parents=True, exist_ok=True)
    (args.reports / "patient_params.json").write_text(json.dumps(out, indent=2))
    print("wrote", args.reports / "patient_params.json")


if __name__ == "__main__":
    main()
