"""Held-out benchmark for M3 (Phase A ship gate).

    python -m ml.evaluate --data-dir ../data/processed/ohiot1dm \
        --train-ids 559 563 570 575 --val-ids 588 --test-ids 591 \
        --report-name benchmark.json

Trains the residual on train windows (fitted per-patient params, y0 =
start_glucose, bolus compartment), gates it on val, then scores the full
model set on the test patients under the fixed protocol:
- y0 = meal-time CGM everywhere
- calibration uses only data strictly before each meal
- fitted params from train patients only (test patients use the
  population median)
- baselines: persistence, ridge, persistence + mean meal response

Writes ml/reports/<report-name>. The hybrid ships only if it beats
physics-only on the held-out test windows; the verdict is printed and
recorded either way.
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
    ridge_predict,
)
from ml.metrics import rmse
from ml.sequence_baseline import gru_predict, train_gru
from ml.train_residual import train_residual
from ml.windows import GRID_MIN

MODELS = ["persistence", "ridge", "mean_meal_response", "gru",
          "physics_only", "hybrid"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, required=True)
    ap.add_argument("--train-ids", nargs="+", required=True)
    ap.add_argument("--val-ids", nargs="+", required=True)
    ap.add_argument("--test-ids", nargs="+", required=True)
    ap.add_argument("--report-name", default="benchmark.json")
    ap.add_argument("--diabetic-type", default="type_1")
    ap.add_argument("--epochs", type=int, default=25)
    ap.add_argument("--no-residual", action="store_true")
    ap.add_argument("--reports", type=Path, default=Path("ml/reports"))
    args = ap.parse_args()

    patient_data, user_by_pid = {}, {}
    for pid in args.train_ids + args.val_ids + args.test_ids:
        user, windows = load_patient(args.data_dir, pid,
                                 diabetic_type=args.diabetic_type)
        patient_data[pid] = (user, windows)
        user_by_pid[pid] = user

    fitted, median = fit_params_for_fold(patient_data, list(args.train_ids))
    params = {pid: params_for(fitted, median, pid)
              for pid in args.train_ids + args.val_ids + args.test_ids}

    # train + gate the residual on train/val
    residual_fn = None
    gate = {"gate_open": None}
    if not args.no_residual:
        with tempfile.TemporaryDirectory() as td:
            wpath = Path(td) / "res.pt"
            gate = train_residual(
                {pid: patient_data[pid][1] for pid in args.train_ids},
                {pid: patient_data[pid][1] for pid in args.val_ids},
                user_by_pid, params, wpath, epochs=args.epochs)
            if gate["gate_open"]:
                residual_fn = TrainedResidual(wpath).evaluate

    train_windows = [w for pid in args.train_ids for w in patient_data[pid][1]]
    ridge_m, ridge_s = fit_ridge(train_windows) if train_windows else (None, None)
    mean_resp = fit_mean_response(train_windows)
    gru_model = train_gru(patient_data, list(args.train_ids), list(args.val_ids))

    all_pairs = {m: [] for m in MODELS}
    all_curves = {m: [] for m in MODELS}
    pairs_by_patient = {}
    for pid in args.test_ids:
        pairs_by_patient[pid] = fold_pairs = {m: [] for m in MODELS}
        windows = patient_data[pid][1]
        if not windows:
            print(f"warning: test patient {pid} has no windows, skipped")
            continue
        k_abs, s_i = params[pid]
        for w in windows:
            phys = physics_predict(w, user_by_pid[pid], k_abs, s_i)
            hyb = physics_predict(w, user_by_pid[pid], k_abs, s_i,
                                  residual_fn=residual_fn) if residual_fn else None
            preds = {
                "persistence": [w.start_glucose] * len(GRID_MIN),
                "ridge": ridge_predict(ridge_m, ridge_s, w) if ridge_m else None,
                "mean_meal_response": [w.start_glucose + d for d in mean_resp],
                "gru": gru_predict(gru_model, user_by_pid[pid], w) if gru_model else None,
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

    per_patient = per_patient_rmse(pairs_by_patient)
    hybrid_rmse = rmse(all_pairs["hybrid"])
    physics_rmse = rmse(all_pairs["physics_only"])
    persist_rmse = rmse(all_pairs["persistence"])
    report = {
        "protocol": ("y0=start_glucose; calibration before=meal_time; "
                     "params fitted on train patients only; test patients use "
                     "population median; baselines fitted on train windows only"),
        "dataset": args.data_dir.name,
        "split": {"train": args.train_ids, "val": args.val_ids,
                  "test": args.test_ids},
        "train_gate": gate,
        "models": {m: model_summary(all_pairs[m], all_curves[m])
                   for m in MODELS if all_pairs[m]},
        "per_patient_rmse": per_patient,
        "bootstrap_95ci_rmse": bootstrap_patient_ci(per_patient),
        "fitted_params": {pid: {"k_abs": round(fitted[pid]["k_abs"], 4),
                                "S_i": round(fitted[pid]["S_i"], 6)}
                          for pid in fitted},
        "ship_gate": {
            "hybrid_beats_physics_only": hybrid_rmse < physics_rmse,
            "hybrid_beats_persistence": hybrid_rmse < persist_rmse,
            "delta_rmse_vs_physics": round(physics_rmse - hybrid_rmse, 2),
        },
    }
    args.reports.mkdir(parents=True, exist_ok=True)
    (args.reports / args.report_name).write_text(json.dumps(report, indent=2))

    lines = [(f"# M3 held-out benchmark ({args.data_dir.name}) — "
              f"test patients {', '.join(args.test_ids)}"), "",
             "| model | RMSE | MAE | Clarke A | Clarke A+B |",
             "|---|---|---|---|---|"]
    for key, m in report["models"].items():
        lines.append(f"| {key} | {m['overall_rmse']} | {m['overall_mae']} | "
                     f"{m['clarke_pct']['A']}% | {m['clarke_pct']['A'] + m['clarke_pct']['B']}% |")
    g = report["ship_gate"]
    lines += ["", (f"Ship gate (hybrid beats physics-only): "
                   f"**{g['hybrid_beats_physics_only']}** "
                   f"(ΔRMSE {g['delta_rmse_vs_physics']} mg/dL)")]
    (args.reports / args.report_name.replace(".json", ".md")).write_text(
        "\n".join(lines) + "\n")
    print("\n".join(lines))
    print("bootstrap 95% CI of mean RMSE:",
          json.dumps(report["bootstrap_95ci_rmse"], indent=2))


if __name__ == "__main__":
    main()
