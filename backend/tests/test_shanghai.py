"""Tests for the Shanghai T2DM converter and pipeline integration."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.convert_shanghai import (
    carb_factor,
    parse_diet,
    parse_sc_insulin,
)

DATA = Path(__file__).resolve().parent.parent.parent / "data" / "processed" / "shanghai"


def test_parse_diet_grams():
    items = parse_diet("Rice 150 g\nVegetable 100 g\nSliced lotus root 50 g")
    assert len(items) == 3
    assert items[0][0] == "Rice" and items[0][1] == 150
    # rice factor 0.28 -> 42 g carbs
    assert items[0][2] == pytest.approx(42.0)
    assert items[0][3] == "exact"


def test_parse_diet_ml_and_bare_number():
    items = parse_diet("Milk 110 ml")
    assert len(items) == 1 and items[0][1] == 110  # ml treated as grams
    items = parse_diet("Shepherd's purse and pork in tofu skin 4")
    assert len(items) == 1 and items[0][1] == 4  # bare number -> grams


def test_parse_diet_skips_unavailable():
    assert parse_diet("data not available") == []


def test_carb_factor_fallback_documented():
    factor, method = carb_factor("rice")
    assert (factor, method) == (0.28, "exact")
    factor, method = carb_factor("some unknown dish xyz")
    assert (factor, method) == (0.10, "fallback")


def test_parse_sc_insulin():
    assert parse_sc_insulin("Gansulin 40R, 6 IU") == 6.0
    assert parse_sc_insulin("") == 0.0
    assert parse_sc_insulin(None) == 0.0


@pytest.mark.skipif(not (DATA / "2000_0_20201230").exists(),
                    reason="shanghai processed data not present")
def test_end_to_end_windows_two_patients():
    from ml.bench import load_patient
    for pid in ("2000_0_20201230", "2016_0_20201224"):
        user, windows = load_patient(DATA, pid, diabetic_type="type_2")
        assert user.user_profile.diabetic_type == "type_2"
        assert len(user.cgm_readings) > 1000
        assert len(windows) > 5
        w = windows[0]
        assert w.carbs_g > 0
        assert 20.0 <= w.start_glucose <= 600.0
        assert len(w.actual) == 25


@pytest.mark.skipif(not (DATA / "2000_0_20201230").exists(),
                    reason="shanghai processed data not present")
def test_meals_csv_flags_estimated():
    import csv
    with open(DATA / "2000_0_20201230" / "meals.csv") as f:
        rows = list(csv.DictReader(f))
    assert rows, "no meals converted"
    assert all(r["carbs_estimated"] == "true" for r in rows)
    assert all(float(r["carbohydrates_g"]) >= 0 for r in rows)
