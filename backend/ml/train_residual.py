"""Train the hybrid residual network (Phase A).

Honest protocol:
- y0 = [start_glucose, I_b] for every window (what eval and serving use).
- Per-window calibrated baseline (data strictly before the meal).
- Per-patient fitted (k_abs, S_i) from TRAIN patients only; the residual
  never sees held-out patients' windows.
- Exogenous bolus schedule per window, same compartment as the solvers.
- Ship gate: weights are saved ONLY if the hybrid beats physics-only on
  the held-out validation windows. A failed gate deletes a stale weights
  file so serving falls back to physics-only.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Dataset

from app.modules.m2_calibration.service import calibrate_user
from app.modules.m3_predictive_core.torch_neural_ode import TorchNeuralODESolver
from ml.bench import physics_predict
from ml.metrics import rmse
from ml.windows import GRID_MIN, MealWindow


class WindowDataset(Dataset):
    def __init__(self, windows: list[MealWindow], user_by_pid: dict,
                 params: dict[str, tuple[float, float]]):
        self.rows = []
        for w in windows:
            state = calibrate_user(user_by_pid[w.patient_id], before=w.meal_time)
            k_abs, s_i = params[w.patient_id]
            bolus = w.bolus_doses
            self.rows.append({
                "carbs": w.carbs_g, "start": w.start_glucose,
                "target": torch.tensor(w.actual, dtype=torch.float32),
                "k_abs": k_abs, "s_i": s_i, "G_b": state.baseline_glucose_mg_dl,
                "bolus": torch.tensor(bolus, dtype=torch.float32)
                if bolus else torch.zeros(0, 2),
            })
        self.max_k = max((r["bolus"].shape[0] for r in self.rows), default=0)

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        K = self.max_k
        bolus = torch.zeros(K, 2)
        if r["bolus"].numel():
            bolus[: r["bolus"].shape[0]] = r["bolus"]
        return {
            "carbs": r["carbs"], "start": r["start"], "target": r["target"],
            "k_abs": r["k_abs"], "s_i": r["s_i"], "G_b": r["G_b"], "bolus": bolus,
        }


def _predict(model: TorchNeuralODESolver, window: MealWindow, state) -> torch.Tensor:
    """Single-window prediction helper (kept for the training smoke test)."""
    device = torch.device("cpu")
    t_span = torch.tensor(GRID_MIN, dtype=torch.float32, device=device)
    y0 = torch.tensor([window.start_glucose, 10.0], dtype=torch.float32, device=device)
    traj = model(t_span, y0, S_i=state.estimated_insulin_sensitivity,
                 k_abs=state.carb_absorption_rate_index, D=window.carbs_g,
                 G_b=state.baseline_glucose_mg_dl)
    return traj[:, 0]


def _loss_on(model, items, loss_fn) -> float:
    """Mean per-window MSE over (window, state) items (smoke test helper)."""
    model.eval()
    total, n = 0.0, 0
    with torch.no_grad():
        for window, state in items:
            pred = _predict(model, window, state)
            actual = torch.tensor(window.actual, dtype=torch.float32)
            total += loss_fn(pred, actual).item()
            n += 1
    return total / max(n, 1)


def _batch_predict(solver, batch, device, t_span):
    carbs = torch.as_tensor(batch["carbs"], dtype=torch.float32, device=device)
    y0 = torch.stack([
        torch.as_tensor(batch["start"], dtype=torch.float32, device=device),
        torch.full((len(batch["start"]),), 10.0, device=device)], dim=1)
    bolus = batch["bolus"].to(device)
    traj = solver(t_span, y0,
                  S_i=torch.as_tensor(batch["s_i"], dtype=torch.float32, device=device),
                  k_abs=torch.as_tensor(batch["k_abs"], dtype=torch.float32, device=device),
                  D=carbs,
                  G_b=torch.as_tensor(batch["G_b"], dtype=torch.float32, device=device),
                  bolus=bolus if bolus.numel() else None)
    return traj[:, :, 0].transpose(0, 1)  # [batch, horizon] glucose


def _eval_rmse(solver, loader, device, t_span) -> float:
    pairs = []
    with torch.no_grad():
        for batch in loader:
            pred = _batch_predict(solver, batch, device, t_span)
            for p, t in zip(pred, batch["target"]):
                pairs += list(zip(t.tolist(), p.tolist()))
    return rmse(pairs)


def train_residual(windows_by_pid: dict[str, list[MealWindow]],
                   val_by_pid: dict[str, list[MealWindow]],
                   user_by_pid: dict,
                   params: dict[str, tuple[float, float]],
                   weights_path: Path,
                   epochs: int = 25, lr: float = 1e-3, seed: int = 0,
                   batch_size: int = 64) -> dict:
    """Train; return metrics and whether the ship gate opened."""
    torch.manual_seed(seed)
    random.seed(seed)
    device = torch.device("cpu")
    t_span = torch.tensor(GRID_MIN, dtype=torch.float32)

    train_windows = [w for pid, ws in windows_by_pid.items() for w in ws]
    val_windows = [w for pid, ws in val_by_pid.items() for w in ws]
    if not train_windows:
        raise ValueError("no training windows")

    train_ds = WindowDataset(train_windows, user_by_pid, params)
    val_ds = WindowDataset(val_windows, user_by_pid, params)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=256)

    solver = TorchNeuralODESolver().to(device)
    opt = torch.optim.Adam(solver.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = torch.nn.MSELoss()

    for epoch in range(epochs):
        solver.train()
        for batch in train_loader:
            opt.zero_grad()
            pred = _batch_predict(solver, batch, device, t_span)
            loss = loss_fn(pred, batch["target"].to(device))
            loss.backward()
            opt.step()

    # held-out gate
    solver.eval()
    hybrid_rmse = _eval_rmse(solver, val_loader, device, t_span)
    pairs = []
    for w in val_windows:
        k_abs, s_i = params[w.patient_id]
        pred = physics_predict(w, user_by_pid[w.patient_id], k_abs, s_i)
        pairs += list(zip(w.actual, pred))
    physics_rmse = rmse(pairs)

    gate_open = hybrid_rmse < physics_rmse
    if gate_open:
        weights_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(solver.dynamics.neural_residual.state_dict(), weights_path)
    elif weights_path.exists():
        weights_path.unlink()  # stale weights must not serve

    return {
        "train_n": len(train_windows), "val_n": len(val_windows),
        "hybrid_val_rmse": round(hybrid_rmse, 2),
        "physics_val_rmse": round(physics_rmse, 2),
        "gate_open": gate_open,
    }


def main() -> None:
    import argparse

    from ml.bench import fit_params_for_fold, load_patient

    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, required=True)
    ap.add_argument("--train-ids", nargs="+", required=True)
    ap.add_argument("--val-ids", nargs="+", required=True)
    ap.add_argument("--params", type=Path, default=None,
                    help="patient_params.json; fitted on train ids if absent")
    ap.add_argument("--weights", type=Path, default=Path("ml/weights/residual_v1.pt"))
    ap.add_argument("--reports", type=Path, default=Path("ml/reports"))
    ap.add_argument("--epochs", type=int, default=25)
    args = ap.parse_args()

    patient_data, user_by_pid = {}, {}
    for pid in args.train_ids + args.val_ids:
        user, windows = load_patient(args.data_dir, pid)
        patient_data[pid] = (user, windows)
        user_by_pid[pid] = user

    if args.params and args.params.exists():
        fitted = json.loads(args.params.read_text())
        params = {pid: (fitted[pid]["k_abs"], fitted[pid]["S_i"]) for pid in fitted}
    else:
        fitted, median = fit_params_for_fold(patient_data, list(args.train_ids))
        params = {pid: (fitted.get(pid, median)["k_abs"],
                        fitted.get(pid, median)["S_i"]) for pid in args.train_ids + args.val_ids}
        args.reports.mkdir(parents=True, exist_ok=True)
        (args.reports / "patient_params.json").write_text(json.dumps(fitted, indent=2))

    metrics = train_residual(
        {pid: patient_data[pid][1] for pid in args.train_ids},
        {pid: patient_data[pid][1] for pid in args.val_ids},
        user_by_pid, params, args.weights, epochs=args.epochs)
    args.reports.mkdir(parents=True, exist_ok=True)
    (args.reports / "train_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
