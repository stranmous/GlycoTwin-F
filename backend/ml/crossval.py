"""Leave-one-patient-out cross-validation for M3 (Phase A).

    python -m ml.crossval --data-dir ../data/processed/ohiot1dm \
        --report-name crossval_ohio.json --epochs 25

Protocol per fold (held-out patient `h`):
- fitted (k_abs, S_i): grid search on TRAIN patients' windows only;
  patient `h` uses the population median (never its own windows).
- residual: trained on train windows (start_glucose y0, per-window
  baseline, bolus compartment), ship-gated on the inner val patient.
- scoring on `h`: per-window calibration (data strictly before each
  meal), y0 = meal-time CGM for every model.
- baselines: persistence, ridge(start_glucose, carbs, 30-min trend),
  persistence + mean meal response (train windows only).

Writes ml/reports/<report-name> and the empirical CI band to
app/modules/m3_predictive_core/data/ci_band.json (per-horizon residual
quantiles of the held-out physics predictions).
"""
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

from app.modules.m3_predictive_core.neural_residual import TrainedResidual
from ml.bench import (
    bootstrap_patient_ci,
    fit_mean_response,
    fit_params_for_fold,
    fit_ridge,
    load_patient,
    model_summary,
    params_for,
    per_patient_rmse,
    physics_predict,
    residual_quantiles_by_horizon,
    ridge_predict,
)
from ml.metrics import rmse
from ml.sequence_baseline import gru_predict, train_gru
from ml.train_residual import train_residual
from ml.windows import GRID_MIN

MODELS = ["persistence", "ridge", "mean_meal_response", "gru",
          "physics_only", "hybrid"]

CI_BAND_PATH = (Path(__file__).resolve().parent.parent
                / "app" / "modules" / "m3_predictive_core" / "data" / "ci_band.json")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, required=True)
    ap.add_argument("--report-name", default="crossval.json")
    ap.add_argument("--diabetic-type", default="type_1")
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--no-residual", action="store_true",
                    help="skip residual training (physics-only vs baselines)")
    ap.add_argument("--ci-band", default="ci_band.json",
                    help="CI band filename under m3 data/ (serving reads ci_band.json)")
    ap.add_argument("--reports", type=Path, default=Path("ml/reports"))
    args = ap.parse_args()

    pids = sorted(p.name for p in args.data_dir.iterdir() if p.is_dir())
    print("LOPO over patients:", pids)

    patient_data, user_by_pid = {}, {}
    for pid in pids:
        user, windows = load_patient(args.data_dir, pid,
                                 diabetic_type=args.diabetic_type)
        patient_data[pid] = (user, windows)
        user_by_pid[pid] = user

    all_pairs = {m: [] for m in MODELS}
    all_curves = {m: [] for m in MODELS}
    pairs_by_patient = {}
    resid_by_horizon = {h: [] for h in GRID_MIN}
    folds = []
    gate_opens = 0

    for held in pids:
        others = [p for p in pids if p != held]
        val_id, train_ids = others[-1], others[:-1]
        train_windows = [w for p in train_ids for w in patient_data[p][1]]
        val_windows = patient_data[val_id][1]
        held_windows = patient_data[held][1]

        fitted, median = fit_params_for_fold(patient_data, train_ids)
        params = {pid: params_for(fitted, median, pid) for pid in pids}

        # fold residual
        residual_fn = None
        gate_open = False
        if not args.no_residual and train_windows and val_windows:
            with tempfile.TemporaryDirectory() as td:
                wpath = Path(td) / "fold.pt"
                gm = train_residual(
                    {pid: patient_data[pid][1] for pid in train_ids},
                    {val_id: val_windows}, user_by_pid, params, wpath,
                    epochs=args.epochs)
                gate_open = gm["gate_open"]
                if gate_open:
                    gate_opens += 1
                    residual_fn = TrainedResidual(wpath).evaluate

        # baselines on train windows
        ridge_m, ridge_s = fit_ridge(train_windows) if train_windows else (None, None)
        mean_resp = fit_mean_response(train_windows)
        gru_model = train_gru(patient_data, train_ids, [val_id])

        fold_pairs = {m: [] for m in MODELS}
        for w in held_windows:
            k_abs, s_i = params[held]
            phys = physics_predict(w, user_by_pid[held], k_abs, s_i)
            hyb = physics_predict(w, user_by_pid[held], k_abs, s_i,
                                  residual_fn=residual_fn) if residual_fn else None
            preds = {
                "persistence": [w.start_glucose] * len(GRID_MIN),
                "ridge": ridge_predict(ridge_m, ridge_s, w) if ridge_m else None,
                "mean_meal_response": [w.start_glucose + d for d in mean_resp],
                "gru": gru_predict(gru_model, user_by_pid[held], w) if gru_model else None,
                "physics_only": phys,
                "hybrid": hyb if hyb is not None else phys,
            }
            for m, pred in preds.items():
                if pred is None:
                    continue
                pairs = list(zip(w.actual, pred))
                fold_pairs[m] += pairs
                all_pairs[m] += pairs
                all_curves[m].append((w.actual, pred))
            for i, a in enumerate(w.actual):
                resid_by_horizon[GRID_MIN[i]].append(a - phys[i])

        if not held_windows:
            print(f"fold held={held}: no windows, skipped from scoring")
            pairs_by_patient.pop(held, None)
            folds.append({"held_out": held, "train": train_ids, "val": val_id,
                          "gate_open": gate_open, "n_windows": 0, "rmse": {}})
            continue
        folds.append({
            "held_out": held, "train": train_ids, "val": val_id,
            "gate_open": gate_open, "n_windows": len(held_windows),
            "rmse": {m: round(rmse(v), 2)
                     for m, v in fold_pairs.items() if v},
        })
        print(f"fold held={held} " +
              " ".join(f"{m}={folds[-1]['rmse'].get(m, 'n/a')}" for m in MODELS))
        pairs_by_patient[held] = fold_pairs

    per_patient = per_patient_rmse(pairs_by_patient)
    report = {
        "method": "leave-one-patient-out",
        "protocol": ("y0=start_glucose; calibration before=meal_time; "
                     "params fitted on train patients only; held-out uses "
                     "population median; baselines fitted on train windows only"),
        "dataset": args.data_dir.name,
        "patients": pids,
        "folds": folds,
        "gate_opens": gate_opens,
        "models": {m: model_summary(all_pairs[m], all_curves[m])
                   for m in MODELS if all_pairs[m]},
        "per_patient_rmse": per_patient,
        "bootstrap_95ci_rmse": bootstrap_patient_ci(per_patient),
        "fitted_params": {pid: {"k_abs": round(p[0], 4), "S_i": round(p[1], 6)}
                          for pid, p in params.items()},
        "ship_gate": {
            "hybrid_beats_physics_only":
                rmse_of(all_pairs, "hybrid") < rmse_of(all_pairs, "physics_only"),
            "hybrid_beats_persistence":
                rmse_of(all_pairs, "hybrid") < rmse_of(all_pairs, "persistence"),
        },
    }
    args.reports.mkdir(parents=True, exist_ok=True)
    (args.reports / args.report_name).write_text(json.dumps(report, indent=2))

    # empirical CI band from held-out physics residuals (shared with serving)
    band = {
        "note": ("EMPIRICAL band: per-horizon 10th/90th percentiles of "
                 "(actual - physics_only prediction) residuals on held-out "
                 f"windows ({args.data_dir.name}). Describes past error, not a "
                 "calibrated predictive interval."),
        "dataset": args.data_dir.name,
        "horizons": residual_quantiles_by_horizon(resid_by_horizon),
    }
    CI_BAND_PATH.parent.mkdir(parents=True, exist_ok=True)
    band_path = CI_BAND_PATH.parent / args.ci_band
    band_path.write_text(json.dumps(band, indent=2))
    print("wrote", args.reports / args.report_name, "and", band_path)
    print(json.dumps(report["ship_gate"], indent=2))


def rmse_of(all_pairs, model):
    from ml.metrics import rmse
    return rmse(all_pairs[model])


if __name__ == "__main__":
    main()
