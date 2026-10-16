"""Phase A regression tests: y0 consistency, calibration cutoff, IOB parsing.

No real patient data: all fixtures are synthetic.
"""
import math
from datetime import datetime, timedelta

import pytest

from app.modules.m1_ingestion.schemas import (
    CGMReadingPayload,
    IngestedUserData,
    InsulinDosePayload,
    MealRecordPayload,
    UserProfilePayload,
)
from app.modules.m2_calibration.service import calibrate_user
from app.modules.m3_predictive_core.ode_solver import solve_trajectory
from app.modules.m3_predictive_core.schemas import MealInput
from ml.windows import extract_windows

torch = pytest.importorskip("torch")


def _synthetic_user(with_insulin: bool = True) -> IngestedUserData:
    t0 = datetime(2026, 1, 1, 8, 0, 0)
    readings = [
        CGMReadingPayload(timestamp=t0 + timedelta(minutes=5 * i),
                          glucose_mg_dl=100.0 + 0.5 * i)
        for i in range(60)  # 8:00 -> 12:55, rising trend
    ]
    meal_t = t0 + timedelta(hours=2)  # 10:00
    meals = [MealRecordPayload(timestamp=meal_t, carbohydrates_g=60.0,
                               protein_g=10.0, fat_g=5.0, meal_type="breakfast")]
    doses = []
    if with_insulin:
        doses = [
            InsulinDosePayload(timestamp=meal_t - timedelta(minutes=60),
                               units=4.0, kind="bolus"),
            InsulinDosePayload(timestamp=meal_t - timedelta(minutes=30),
                               units=6.0, kind="slow"),  # background: excluded
        ]
    return IngestedUserData(user_id="synthetic",
                            user_profile=UserProfilePayload(user_id="synthetic"),
                            cgm_readings=readings, meal_records=meals,
                            insulin_doses=doses)


def test_y0_consistency_train_eval_serve():
    """Train (torch), eval (scipy) and serve (service) must all start the
    forecast at the same start glucose — the meal-time CGM."""
    from app.modules.m2_calibration.schemas import CalibratedState
    from app.modules.m3_predictive_core.service import generate_trajectory
    from app.modules.m3_predictive_core.torch_neural_ode import TorchNeuralODESolver
    from ml.train_residual import _predict

    user = _synthetic_user()
    w = extract_windows(user)[0]
    state = calibrate_user(user, before=w.meal_time)
    meal = MealInput(carbohydrates_g=w.carbs_g, protein_g=w.protein_g,
                     fat_g=w.fat_g, glycemic_index=70.0)

    # eval path (scipy solver)
    _, phys = solve_trajectory(state, meal, neural_residual_fn=lambda *_: 0.0,
                               start_glucose=w.start_glucose,
                               bolus_doses=w.bolus_doses)
    # train path (torch solver)
    torch_pred = _predict(TorchNeuralODESolver(), w, state)
    # serving path
    cal_state = CalibratedState(**state.model_dump())
    served = generate_trajectory(cal_state, meal,
                                 current_glucose_mg_dl=w.start_glucose)

    assert phys[0] == pytest.approx(w.start_glucose, abs=1e-6)
    assert float(torch_pred[0]) == pytest.approx(w.start_glucose, abs=1e-3)
    assert served.glucose_values_mg_dl[0] == pytest.approx(w.start_glucose, abs=1e-6)


def test_calibration_before_cutoff_ignores_future_data():
    """calibrate_user(before=t) must equal calibrating on the truncated
    history — no look-ahead into data after the cutoff."""
    # 3.5 days of 5-min readings so we are NOT in cold start (needs >= 864).
    t0 = datetime(2026, 1, 1, 8, 0, 0)
    readings = [
        CGMReadingPayload(timestamp=t0 + timedelta(minutes=5 * i),
                          glucose_mg_dl=100.0 + 0.05 * i)
        for i in range(1008)
    ]
    meal_t = t0 + timedelta(days=3, hours=2)
    user = IngestedUserData(
        user_id="synthetic",
        user_profile=UserProfilePayload(user_id="synthetic"),
        cgm_readings=readings,
        meal_records=[MealRecordPayload(timestamp=meal_t, carbohydrates_g=60.0,
                                        protein_g=10.0, fat_g=5.0,
                                        meal_type="breakfast")])

    cut = calibrate_user(user, before=meal_t)
    truncated = user.model_copy(update={
        "cgm_readings": [r for r in user.cgm_readings if r.timestamp < meal_t],
        "meal_records": [m for m in user.meal_records if m.timestamp < meal_t],
    })
    ref = calibrate_user(truncated)
    assert not cut.is_cold_start
    assert cut.baseline_glucose_mg_dl == pytest.approx(ref.baseline_glucose_mg_dl)

    # and it must differ from full-history calibration (future data leaks)
    full = calibrate_user(user)
    assert full.baseline_glucose_mg_dl != pytest.approx(cut.baseline_glucose_mg_dl)


def test_iob_parsing_synthetic_bolus():
    """A 4 U bolus 60 min pre-meal decays with BOLUS_DECAY_PER_MIN; the
    slow/background dose is excluded from IOB and the bolus schedule."""
    from ml.windows import BOLUS_DECAY_PER_MIN

    user = _synthetic_user()
    w = extract_windows(user)[0]
    expected = 4.0 * math.exp(-BOLUS_DECAY_PER_MIN * 60.0)
    assert w.insulin_on_board == pytest.approx(expected, rel=1e-6)
    assert w.bolus_doses == [(-60.0, 4.0)]


def test_serve_defaults_to_calibrated_baseline_cold_start():
    """Omitting current_glucose_mg_dl falls back to the calibrated baseline."""
    from app.modules.m2_calibration.schemas import CalibratedState
    from app.modules.m3_predictive_core.service import generate_trajectory

    user = _synthetic_user()
    w = extract_windows(user)[0]
    state = calibrate_user(user, before=w.meal_time)
    cal_state = CalibratedState(**state.model_dump())
    meal = MealInput(carbohydrates_g=w.carbs_g, protein_g=w.protein_g,
                     fat_g=w.fat_g, glycemic_index=70.0)
    served = generate_trajectory(cal_state, meal)
    assert served.glucose_values_mg_dl[0] == pytest.approx(
        cal_state.baseline_glucose_mg_dl, abs=1e-6)


def test_api_predict_accepts_current_glucose(authed_client):
    """POST /predictions/predict honors current_glucose_mg_dl as the
    forecast's initial condition."""
    from app.modules.m2_calibration.schemas import CalibratedState

    client, headers = authed_client
    user = _synthetic_user()
    w = extract_windows(user)[0]
    state = calibrate_user(user, before=w.meal_time)
    cal_state = CalibratedState(**state.model_dump())
    body = {
        "calibrated_state": cal_state.model_dump(mode="json"),
        "meal_input": {"carbohydrates_g": w.carbs_g, "protein_g": w.protein_g,
                       "fat_g": w.fat_g, "glycemic_index": 70.0},
        "current_glucose_mg_dl": 142.0,
    }
    r = client.post("/api/v1/predictions/predict", json=body, headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["glucose_values_mg_dl"][0] == pytest.approx(142.0, abs=1e-6)
    assert out["model_version"] == "v2.1.0-physics-only"  # no trained weights configured
    assert len(out["confidence_interval_lower"]) == 25
