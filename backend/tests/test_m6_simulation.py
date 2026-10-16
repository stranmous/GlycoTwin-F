"""M6 what-if simulation: correctness tests for the simulation MATH.

These tests check that the counterfactual engine behaves the way the physics
says it should — not merely that outputs land in a 20-600 plausibility band:
- halving carbs (roughly) halves the glucose excursion (iAUC);
- a post-meal walk lowers the peak versus no walk;
- zero carbs produce a near-flat curve.
Plus the cache-key contract: two requests that differ only in the server-side
calibration timestamp must share a cache entry.
"""
from datetime import UTC, datetime

from app.core.cache import simulation_cache
from app.modules.m2_calibration.schemas import CalibratedState
from app.modules.m3_predictive_core.schemas import MealInput
from app.modules.m6_simulation.comparator import compare_trajectories
from app.modules.m6_simulation.schemas import (
    ActivityInput,
    SimulationComparisonRequest,
    SimulationScenario,
)
from app.modules.m6_simulation.service import run_counterfactual_simulation


def _state() -> CalibratedState:
    return CalibratedState(
        user_id="m6-test",
        phenotype_cluster_id="test",
        baseline_glucose_mg_dl=100.0,
        estimated_insulin_sensitivity=0.02,
        carb_absorption_rate_index=0.05,
        confidence_score=0.8,
        is_cold_start=False,
    )


def _meal(carbs: float) -> MealInput:
    return MealInput(carbohydrates_g=carbs, protein_g=10.0, fat_g=5.0,
                     glycemic_index=70.0)


def _request(carbs_base: float, carbs_alt: float,
             walk_min: float = 0.0) -> SimulationComparisonRequest:
    state = _state()
    return SimulationComparisonRequest(
        calibrated_state=state,
        baseline_scenario=SimulationScenario(
            meal=_meal(carbs_base), activity=ActivityInput()),
        counterfactual_scenario=SimulationScenario(
            meal=_meal(carbs_alt),
            activity=ActivityInput(name="walk", duration_minutes=walk_min,
                                   intensity_factor=1.0)),
    )


def test_halving_carbs_halves_excursion():
    """iAUC should scale ~linearly with carbs (mentor measured 0.51x)."""
    req = _request(60.0, 30.0)
    result = run_counterfactual_simulation(req)
    base_iauc = result.baseline_metrics.iauc_mg_dl_min
    alt_iauc = result.counterfactual_metrics.iauc_mg_dl_min
    assert base_iauc > 0
    ratio = alt_iauc / base_iauc
    assert 0.4 < ratio < 0.6, f"expected ~0.5x excursion, got {ratio:.3f}"


def test_walk_reduces_peak_vs_no_walk():
    """Same meal: a 30-min walk must lower the peak glucose."""
    req = _request(60.0, 60.0, walk_min=30.0)
    result = run_counterfactual_simulation(req)
    assert (result.counterfactual_metrics.peak_glucose_mg_dl
            < result.baseline_metrics.peak_glucose_mg_dl)


def test_zero_carbs_gives_near_flat_curve():
    """No carbs in, (almost) no excursion out."""
    req = _request(60.0, 0.0)
    result = run_counterfactual_simulation(req)
    alt = result.counterfactual_metrics
    assert alt.peak_glucose_mg_dl - 100.0 < 10.0
    assert alt.iauc_mg_dl_min < 0.25 * result.baseline_metrics.iauc_mg_dl_min


def test_identical_meal_gives_zero_delta():
    """Sanity: same scenario twice must produce identical trajectories."""
    req = _request(45.0, 45.0)
    result = run_counterfactual_simulation(req)
    assert result.delta_metrics.delta_peak_glucose_mg_dl == 0.0
    assert result.delta_metrics.delta_iauc_mg_dl_min == 0.0


def test_cache_key_ignores_calibration_timestamp():
    """Two requests differing only in the server-side calibration timestamp
    must produce the same cache key — otherwise identical simulations never
    hit the cache."""
    req1 = _request(60.0, 30.0)
    req2 = _request(60.0, 30.0)
    req2.calibrated_state.calibration_timestamp = datetime(2020, 1, 1, tzinfo=UTC)
    assert req1.cache_key_dict() == req2.cache_key_dict()
    k1 = simulation_cache._make_key("simulation_compare", req1.cache_key_dict())
    k2 = simulation_cache._make_key("simulation_compare", req2.cache_key_dict())
    assert k1 == k2


def test_cache_key_changes_with_meal():
    """Different carbs must NOT collide in the cache."""
    req1 = _request(60.0, 30.0)
    req2 = _request(60.0, 45.0)
    k1 = simulation_cache._make_key("simulation_compare", req1.cache_key_dict())
    k2 = simulation_cache._make_key("simulation_compare", req2.cache_key_dict())
    assert k1 != k2


def test_second_identical_request_is_cache_hit():
    """End-to-end through the cache proxy: store with one timestamped
    request, fetch with another — must hit."""
    simulation_cache.clear()
    req1 = _request(60.0, 30.0)
    req2 = _request(60.0, 30.0)
    req2.calibrated_state.calibration_timestamp = datetime(2021, 6, 1, tzinfo=UTC)
    p1, p2 = req1.cache_key_dict(), req2.cache_key_dict()
    assert simulation_cache.get_simulation_result("m6test", p2) is None
    simulation_cache.set_simulation_result("m6test", p1, {"marker": "cached"})
    assert simulation_cache.get_simulation_result("m6test", p2) == {"marker": "cached"}
    simulation_cache.clear()


def test_compare_trajectories_delta_sign():
    """The comparator itself: lower-carb curve must show negative deltas."""
    from app.modules.m3_predictive_core.service import generate_trajectory
    state = _state()
    base = generate_trajectory(state, _meal(60.0), current_glucose_mg_dl=100.0)
    alt = generate_trajectory(state, _meal(30.0), current_glucose_mg_dl=100.0)
    _, _, delta = compare_trajectories(base, alt)
    assert delta.delta_peak_glucose_mg_dl < 0
    assert delta.delta_iauc_mg_dl_min < 0
