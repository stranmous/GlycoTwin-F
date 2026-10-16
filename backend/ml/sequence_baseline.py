"""FE-1 sequence baseline: a small GRU forecaster for the M3 benchmark.

The report's FE-1 promised a recurrent sequence model; instead of dropping the
requirement, this implements it as a learned baseline alongside persistence,
ridge, physics-only and hybrid. It is deliberately small (one GRU layer) and
trained only on train-patient windows — the same earlier-data rule as
everything else in ml/bench.py.

Input per window: the 12 CGM readings before the meal (1 h at 5-min cadence,
mg/dL / 200) plus static features (carbs, insulin-on-board, 30-min trend).
Output: the 25-point post-meal trajectory (0..120 min every 5 min).
"""
from __future__ import annotations

import numpy as np
import torch
from torch import nn

N_HIST = 12  # pre-meal CGM points (1 h)
GRID_N = 25  # post-meal forecast points


def history_vector(user, window, n_hist: int = N_HIST) -> list[float]:
    """CGM readings strictly before the meal, oldest-first, /200 normalized.

    Short series are left-padded with the meal-time glucose; the earlier-data
    rule holds because nothing at or after meal_time is used.
    """
    readings = sorted(
        (r for r in user.cgm_readings if r.timestamp < window.meal_time),
        key=lambda r: r.timestamp)
    vals = [r.glucose_mg_dl / 200.0 for r in readings[-n_hist:]]
    pad = [window.start_glucose / 200.0] * (n_hist - len(vals))
    return pad + vals


def static_features(window) -> list[float]:
    return [window.carbs_g / 100.0,
            (window.insulin_on_board or 0.0) / 10.0,
            (window.trend_30min or 0.0) / 50.0]


class GruForecaster(nn.Module):
    def __init__(self, hidden: int = 32):
        super().__init__()
        self.gru = nn.GRU(input_size=1, hidden_size=hidden, batch_first=True)
        self.head = nn.Sequential(
            nn.Linear(hidden + 3, hidden), nn.ReLU(),
            nn.Linear(hidden, GRID_N))

    def forward(self, hist, static):
        _, h = self.gru(hist.unsqueeze(-1))
        x = torch.cat([h.squeeze(0), static], dim=1)
        return self.head(x)


def _tensors(patient_data: dict, pids: list[str]):
    """(hist [N,12], static [N,3], target [N,25]) tensors for given patients."""
    H, S, Y = [], [], []
    for pid in pids:
        user, windows = patient_data[pid]
        for w in windows:
            H.append(history_vector(user, w))
            S.append(static_features(w))
            Y.append([v / 200.0 for v in w.actual])
    return (torch.tensor(H, dtype=torch.float32),
            torch.tensor(S, dtype=torch.float32),
            torch.tensor(Y, dtype=torch.float32))


def train_gru(patient_data: dict, train_ids: list[str], val_ids: list[str],
              epochs: int = 60, lr: float = 1e-3,
              seed: int = 42) -> GruForecaster | None:
    torch.manual_seed(seed)
    np.random.seed(seed)
    Ht, St, Yt = _tensors(patient_data, train_ids)
    if len(Ht) == 0:
        return None
    Hv, Sv, Yv = _tensors(patient_data, val_ids)
    model = GruForecaster()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()
    best, best_state = float("inf"), None
    for _ in range(epochs):
        model.train()
        opt.zero_grad()
        loss = loss_fn(model(Ht, St), Yt)
        loss.backward()
        opt.step()
        if len(Hv):
            model.eval()
            with torch.no_grad():
                v = loss_fn(model(Hv, Sv), Yv).item()
            if v < best:
                best, best_state = v, {k: v.detach().clone()
                                       for k, v in model.state_dict().items()}
    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()
    return model


def gru_predict(model: GruForecaster, user, window) -> list[float]:
    with torch.no_grad():
        h = torch.tensor([history_vector(user, window)], dtype=torch.float32)
        s = torch.tensor([static_features(window)], dtype=torch.float32)
        out = model(h, s).squeeze(0)
    return [float(v) * 200.0 for v in out]
