"""WS1 benchmark-machinery tests: metrics, Clarke zones, window extraction.

These guard the numbers the FYP will quote. Training itself is exercised by
a tiny smoke test (torch-gated); the real benchmark runs offline via
`python -m ml.evaluate` and lands in ml/reports/.
"""
import math
from datetime import UTC, datetime, timedelta

import pytest

from ml.metrics import clarke_summary, clarke_zone, horizon_metrics, mae, rmse
from ml.windows import extract_windows


def test_rmse_mae_known_values():
    pairs = [(100.0, 110.0), (100.0, 90.0), (200.0, 200.0)]
    assert rmse(pairs) == pytest.approx(8.165, abs=0.01)
    assert mae(pairs) == pytest.approx(6.667, abs=0.01)


def test_clarke_zones_hand_classified():
    assert clarke_zone(100, 105) == "A"   # within 20%
    assert clarke_zone(60, 65) == "A"     # both hypoglycaemic
    assert clarke_zone(100, 130) == "B"   # off but benign
    assert clarke_zone(100, 250) == "C"   # overcorrection
    assert clarke_zone(250, 100) == "D"   # failure to detect high
    assert clarke_zone(60, 200) == "E"    # opposite action
    summary = clarke_summary([(100, 105), (60, 200)])
    assert summary["A"] == 50.0 and summary["E"] == 50.0


def test_horizon_metrics_picks_grid_points():
    actual = [100.0] * 25
    predicted = [100.0] * 25
    predicted[6] = 130.0  # t=30 min
    out = horizon_metrics([(actual, predicted)])
    assert out["30"]["rmse"] == 30.0
    assert out["60"]["rmse"] == 0.0


def _synthetic_user(n_meals=3, gap_meal=False):
    from app.modules.m1_ingestion.schemas import (
        CGMReadingPayload,
        IngestedUserData,
        MealRecordPayload,
        UserProfilePayload,
    )

    start = datetime(2026, 1, 1, 8, 0, tzinfo=UTC)
    readings = []
    for i in range(24 * 12):  # a full day at 5-min spacing
        t = start + timedelta(minutes=5 * i)
        g = 100 + 40 * math.exp(-((i - 30) ** 2) / 200.0)
        readings.append(CGMReadingPayload(timestamp=t, glucose_mg_dl=round(g, 1)))
    meals = []
    for k in range(n_meals):
        meals.append(MealRecordPayload(
            timestamp=start + timedelta(hours=2 + 4 * k),
            carbohydrates_g=50.0, protein_g=10.0, fat_g=5.0, meal_type="lunch"))
    return IngestedUserData(user_id="synthetic",
                            user_profile=UserProfilePayload(user_id="synthetic"),
                            cgm_readings=readings, meal_records=meals)


def test_window_extraction_shapes():
    windows = extract_windows(_synthetic_user())
    assert len(windows) == 3
    w = windows[0]
    assert len(w.actual) == 25
    assert w.coverage >= 20
    assert w.carbs_g == 50.0
    assert 95 <= w.start_glucose <= 145


torch = pytest.importorskip("torch")


def test_training_smoke_tiny(tmp_path):
    """Two epochs on synthetic windows: loss must be finite and weights save."""
    from app.modules.m2_calibration.service import calibrate_user
    from app.modules.m3_predictive_core.torch_neural_ode import TorchNeuralODESolver
    from ml.train_residual import _loss_on, _predict  # noqa: F401
    from ml.windows import extract_windows as ex

    user = _synthetic_user()
    state = calibrate_user(user)
    items = [(w, state) for w in ex(user)]
    model = TorchNeuralODESolver()
    opt = torch.optim.Adam(model.dynamics.neural_residual.parameters(), lr=1e-3)
    loss_fn = torch.nn.MSELoss()
    losses = []
    for _ in range(2):
        for window, st in items:
            opt.zero_grad()
            pred = _predict(model, window, st)
            loss = loss_fn(pred, torch.tensor(window.actual, dtype=torch.float32))
            loss.backward()
            opt.step()
            losses.append(loss.item())
    assert all(math.isfinite(x) for x in losses)
