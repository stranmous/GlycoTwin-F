"""M2 calibration correctness tests.

These test that the least-squares fit actually estimates (not just that
numbers fall in 20-600): synthetic data generated from known (k_abs, S_i)
must recover those parameters, the `before` cutoff must exclude later data,
and the honest labels must reflect what really ran.
"""
from datetime import UTC, datetime, timedelta

import pytest

from app.modules.m1_ingestion.schemas import (
    CGMReadingPayload,
    IngestedUserData,
    MealRecordPayload,
)
from app.modules.m2_calibration import phenotype as phenotype_mod
from app.modules.m2_calibration.schemas import CalibratedState
from app.modules.m2_calibration.service import calibrate_user
from app.modules.m3_predictive_core.ode_solver import solve_trajectory
from app.modules.m3_predictive_core.schemas import MealInput

TRUTH_K_ABS = 0.06   # on the fit grid -> exact recovery expected
TRUTH_S_I = 0.0008   # on the fit grid -> exact recovery expected
TRUTH_BASELINE = 95.0  # matches the cold-start demographic default, so the
# per-window earlier-data baseline used inside the fit equals the truth
N_MEALS = 4


def _synthetic_user(n_meals: int = N_MEALS) -> IngestedUserData:
    """User whose CGM is the physics ODE itself run with known parameters."""
    truth = CalibratedState(
        user_id="synth", phenotype_cluster_id="cluster_default",
        baseline_glucose_mg_dl=TRUTH_BASELINE,
        estimated_insulin_sensitivity=TRUTH_S_I,
        carb_absorption_rate_index=TRUTH_K_ABS,
        confidence_score=0.5, is_cold_start=True)
    meal_in = MealInput(carbohydrates_g=60.0, protein_g=0.0, fat_g=0.0,
                        glycemic_index=70.0)
    readings: list[CGMReadingPayload] = []
    meals: list[MealRecordPayload] = []
    t0 = datetime(2026, 1, 1, 8, 0, tzinfo=UTC)
    for m in range(n_meals):
        mt = t0 + timedelta(hours=6 * m)
        _, actual = solve_trajectory(
            truth, meal_in, neural_residual_fn=lambda *_: 0.0,
            start_glucose=110.0, bolus_doses=[])
        # 30 min of flat pre-meal history, then the true curve on the grid
        for offset in range(-30, 125, 5):
            ts = mt + timedelta(minutes=offset)
            val = 110.0 if offset <= 0 else actual[offset // 5]
            readings.append(CGMReadingPayload(timestamp=ts, glucose_mg_dl=val))
        meals.append(MealRecordPayload(timestamp=mt, carbohydrates_g=60.0,
                                       protein_g=0.0, fat_g=0.0))
    return IngestedUserData(user_id="synth", cgm_readings=readings,
                            meal_records=meals)


def test_fit_recovers_known_parameters():
    """Least squares on ODE-generated data returns the generating params."""
    state = calibrate_user(_synthetic_user(), fit_physics=True)
    assert state.estimation_method == "least_squares_fit"
    assert state.n_fit_windows == N_MEALS
    assert state.carb_absorption_rate_index == pytest.approx(TRUTH_K_ABS)
    assert state.estimated_insulin_sensitivity == pytest.approx(TRUTH_S_I)


def test_before_cutoff_excludes_later_meals():
    """Windows at/after `before` must not enter the fit (earlier-data rule)."""
    user = _synthetic_user()
    meal_times = sorted(m.timestamp for m in user.meal_records)
    # only the first two meals visible -> too few windows -> honest default
    early = calibrate_user(user, before=meal_times[2], fit_physics=True)
    assert early.estimation_method == "demographic_default"
    assert early.n_fit_windows == 2
    # all four meals visible -> fit runs
    late = calibrate_user(user, before=meal_times[3] + timedelta(hours=3),
                           fit_physics=True)
    assert late.estimation_method == "least_squares_fit"
    assert late.n_fit_windows == 4


def test_few_windows_keep_demographic_defaults():
    """< 3 windows: no fit is invented; defaults kept and labelled."""
    state = calibrate_user(_synthetic_user(n_meals=1), fit_physics=True)
    assert state.estimation_method == "demographic_default"
    assert state.n_fit_windows == 1
    assert state.carb_absorption_rate_index == pytest.approx(0.1)
    assert state.estimated_insulin_sensitivity == pytest.approx(0.002)


def test_fit_opt_in_only_benchmark_path_unchanged():
    """Default calibrate_user does NOT fit (ml/ callers do their own fitting
    and must not pay for or be changed by a redundant serving fit)."""
    state = calibrate_user(_synthetic_user())
    assert state.estimation_method == "demographic_default"
    assert state.n_fit_windows == 0
    assert state.carb_absorption_rate_index == pytest.approx(0.1)
    assert state.estimated_insulin_sensitivity == pytest.approx(0.002)


def test_no_proxy_language_or_multipliers():
    """The Bayesian/Kalman proxy is gone: no such file/function, no claim to
    be Bayesian/Kalman, no fixed-constant if/else multipliers."""
    import pathlib
    import re
    mod_dir = pathlib.Path(phenotype_mod.__file__).parent
    assert not (mod_dir / "adaptive_filter.py").exists()
    src = (mod_dir / "parameter_fit.py").read_text()
    svc = (mod_dir / "service.py").read_text()
    assert "apply_adaptive_filter" not in svc
    lowered = src.lower()
    # claiming patterns ("X update", "X filter", "X proxy" as the method)
    for pat in (r"bayesian (update|filter|estimation)",
                r"kalman (filter|update|proxy)",
                r"\bproxy\b.*(?:update|filter)",
                r"\(bayesian/kalman proxy\)"):
        assert not re.search(pat, lowered), pat
    # the old fixed-constant multipliers
    for pat in (r"\*=\s*0\.85", r"\*=\s*1\.15", r"\*=\s*1\.05"):
        assert not re.search(pat, src), pat


def test_phenotype_clusters_labelled_rule_based():
    """cluster_* ids must be documented as rule-based BMI buckets, not
    data-derived clusters."""
    doc = (phenotype_mod.assign_phenotype.__doc__ or "").lower()
    assert "rule-based" in doc
    assert "no clustering" in doc or "not data-derived" in doc
