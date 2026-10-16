"""M5 tests — the merged meal pipeline (report M5 FE-1..FE-4).

Fully offline. The nutrition maths (estimator Decimal calculator) is checked
exactly; the staged pipeline runs end-to-end in fixture vision mode (no model
weights in CI), which exercises the real segmentation/depth/scale/volume
stage code with deterministic stand-in perception.
"""
from decimal import Decimal
from io import BytesIO

from PIL import Image

from app.modules.m5_nutrition.calculator import (
    FoodNotFoundError,
    calculate_nutrition,
    calculate_nutrition_for_alias,
)
from app.modules.m5_nutrition.service import get_catalog, list_dishes, run_estimate


def _png_bytes(size: int = 200) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (size, size), (180, 120, 60)).save(buf, format="PNG")
    return buf.getvalue()


# --- catalog + Decimal calculator (exact maths) -----------------------------

def test_catalog_resolves_english_urdu_and_roman_aliases():
    catalog = get_catalog()
    en = catalog.resolve("Biryani")
    ur = catalog.resolve("بریانی")
    assert en is not None and ur is not None
    assert en.food_id == ur.food_id == "biryani_generic"


def test_decimal_calculator_is_exact():
    catalog = get_catalog()
    amount = calculate_nutrition(catalog, "biryani_generic", Decimal(250))
    # exact decimal math against whatever the loaded profile carries
    per100 = Decimal(str(catalog.resolve("biryani").nutrients_per_100g.calories_kcal))
    assert amount.calories_kcal == (per100 * Decimal("2.5")).quantize(Decimal("0.01"))
    via_alias = calculate_nutrition_for_alias(catalog, "biryani", 250)
    assert via_alias == amount


def test_calculator_rejects_unknown_food():
    catalog = get_catalog()
    try:
        calculate_nutrition(catalog, "not_a_dish", 100)
        raise AssertionError("expected FoodNotFoundError")
    except FoodNotFoundError:
        pass


def test_dish_list_exposes_profiles():
    dishes = {d["food_id"]: d for d in list_dishes()}
    assert dishes["biryani_generic"]["has_nutrition_profile"] is True


# --- staged pipeline, fixture vision -----------------------------------------

def test_pipeline_end_to_end_fixture_mode():
    # Fixture mode runs every stage (plumbing demo) but reports NO numbers:
    # the stand-in perception is deterministic drawing, not measurement.
    result = run_estimate(
        _png_bytes(), "image/png",
        dish_hint="biryani", plate_diameter_cm=26.0,
    )
    assert result["status"] == "rejected", result.get("message")
    assert result["reason"] == "fixture_mode"
    assert result["vision_mode"] == "fixture"
    assert result["calories_kcal"] is None
    assert result["items"] == []

    stages = [r.name for r in result["stage_records"]]
    assert stages == ["quality", "segmentation", "depth", "geometry",
                      "nutrition", "uncertainty"]
    assert all(r.succeeded for r in result["stage_records"])


def test_pipeline_rejects_non_image():
    result = run_estimate(b"not an image", "text/plain", dish_hint="biryani")
    assert result["status"] == "rejected"
    assert result["stage_records"][-1].succeeded is False


def test_pipeline_unknown_dish_rejected():
    # Assisted logging: without a catalog dish there is no nutrition to
    # report — the run is rejected instead of returning mass-only fiction.
    result = run_estimate(
        _png_bytes(), "image/png",
        dish_hint="sushi", plate_diameter_cm=26.0,
    )
    assert result["status"] == "rejected"
    assert result["reason"] == "dish_unknown"


def test_pipeline_missing_dish_rejected():
    result = run_estimate(
        _png_bytes(), "image/png",
        dish_hint=None, plate_diameter_cm=26.0,
    )
    assert result["status"] == "rejected"
    assert result["reason"] == "dish_unidentified"


# --- API ---------------------------------------------------------------------

def test_api_estimate_and_dishes(authed_client):
    client, headers = authed_client
    r = client.post(
        "/api/v1/nutrition/estimate",
        files={"image": ("meal.png", _png_bytes(), "image/png")},
        data={"dish_hint": "biryani", "plate_diameter_cm": "26"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # test env has no vision weights -> fixture mode refuses numbers
    assert body["status"] == "rejected"
    assert body["reason"] == "fixture_mode"
    assert body["catalog_status"] == "provisional"

    r = client.get("/api/v1/nutrition/dishes", headers=headers)
    assert r.status_code == 200
    assert any(d["food_id"] == "biryani_generic" for d in r.json())


def test_models_mode_aggregates_one_dish_once():
    """One-dish aggregation: segment volumes are summed first and ONE
    nutrition computation runs on the total mass (the old code ran the full
    dish's nutrition per segment and summed — double counting)."""
    from app.modules.m5_nutrition.pipeline import aggregate_one_dish_nutrition
    from app.modules.m5_nutrition.service import get_catalog

    catalog = get_catalog()
    profile = catalog.resolve("biryani")
    assert profile is not None
    warnings: list = []
    segments = [
        {"id": 0, "estimated_volume_cm3": 200.0, "requested_label": "biryani"},
        {"id": 1, "estimated_volume_cm3": 150.0, "requested_label": "biryani"},
    ]
    items, total_vol, total_mass, amount = aggregate_one_dish_nutrition(
        catalog, profile, segments, warnings)
    assert float(total_vol) == 350.0
    # single nutrition computation on the summed mass
    expected = calculate_nutrition(catalog, profile.food_id, total_mass)
    assert amount.calories_kcal == expected.calories_kcal
    assert amount.carbs_g == expected.carbs_g
    assert len(items) == 2
    assert "calories_kcal" not in items[0]  # geometry only per segment


def test_pipeline_cold_start_no_deadlock():
    """Regression (Phase 4): the first-ever request used to hang forever —
    get_pipeline() held the service lock while get_catalog() re-acquired it.
    Reset both singletons and hit the pipeline first, like a cold server."""
    from app.modules.m5_nutrition import service

    service._catalog = None
    service._pipeline = None
    result = run_estimate(_png_bytes(), "image/png",
                          dish_hint="biryani", plate_diameter_cm=26.0)
    # must return (fixture-mode refusal) rather than hang on the lock
    assert result["status"] == "rejected"
    assert result["reason"] == "fixture_mode"
    assert result["stage_records"], "plumbing stages must still run"


# --- curated catalog v1 (WS2) -------------------------------------------------

def test_curated_catalog_v1_loads_with_governance():
    from pathlib import Path

    from app.modules.m5_nutrition.catalog import load_catalog

    path = Path(__file__).parents[1] / "app/modules/m5_nutrition/data/dish_catalog_v1.json"
    catalog = load_catalog(path)
    assert catalog.status == "provisional"
    assert len(catalog.taxonomy) >= 25
    for taxa in catalog.taxonomy.values():
        if taxa.kind in {"dish", "component"}:
            profile = catalog.resolve(taxa.roman_urdu_name)
            assert profile.provenance.data_class == "provisional"
            assert profile.provenance.source_ids, "provisional data must cite sources"


def test_curated_catalog_resolves_roman_urdu_aliases():
    from app.modules.m5_nutrition.service import get_catalog

    catalog = get_catalog()
    assert catalog.resolve("cholay").food_id == "chana_masala"
    assert catalog.resolve("qeema").food_id == "keema"
    assert catalog.resolve("doodh patti").food_id == "chai"


def test_curated_catalog_includes_fried_eggs():
    from app.modules.m5_nutrition.service import get_catalog

    profile = get_catalog().resolve("anda fry")
    assert profile is not None
    assert profile.food_id == "fried_eggs"
    assert profile.uncertainty.relative_percent == Decimal("45")


def test_models_mode_without_reference_falls_back_to_plate_scale():
    """A normal meal photo (no coin, no plate size) must degrade to an assumed
    26 cm plate scale with a warning, not crash the whole estimate."""
    from app.modules.m5_nutrition.pipeline import (
        MealNutritionPipeline,
        fixture_depth_factory,
        fixture_fastsam_factory,
    )
    from app.modules.m5_nutrition.service import _settings_ns, get_catalog

    pipeline = MealNutritionPipeline(
        get_catalog(), _settings_ns(), vision_mode="models",
        fastsam_factory=fixture_fastsam_factory, depth_factory=fixture_depth_factory,
    )
    result = pipeline.run(_png_bytes(), "image/png", dish_hint="biryani")
    assert result["status"] == "estimated", result.get("message")
    assert any("No reference object in frame" in w for w in result["warnings"])
    geometry = [r for r in result["stage_records"] if r.name == "geometry"]
    assert geometry and geometry[0].adapter == "plate-diameter-assumed"


# --- CLIP dish suggestion (mocked; no 350MB weights in CI) -------------------

class _FakeSuggester:
    """Stand-in for DishSuggester: deterministic suggestions for tests."""
    def __init__(self, suggestions):
        self._suggestions = suggestions

    def suggest(self, image, top_k=3, threshold=0.0):
        return self._suggestions[:top_k]


def _pipeline_with_fake_suggester(suggestions):
    from app.modules.m5_nutrition.service import get_pipeline
    pipe = get_pipeline()
    pipe._suggester = _FakeSuggester(suggestions)
    return pipe


def test_suggestion_returned_when_no_dish_hint():
    pipe = _pipeline_with_fake_suggester([
        {"food_id": "biryani_generic", "label": "Biryani", "score": 0.31},
        {"food_id": "pulao", "label": "Pulao", "score": 0.29},
    ])
    try:
        result = pipe.run(_png_bytes(), "image/png", dish_hint=None,
                          plate_diameter_cm=26.0)
    finally:
        pipe._suggester = None
    assert result["status"] == "rejected"
    assert result["reason"] == "dish_suggestion"
    assert len(result["dish_suggestions"]) == 2
    assert result["dish_suggestions"][0]["food_id"] == "biryani_generic"


def test_no_suggestion_below_threshold_returns_unidentified():
    pipe = _pipeline_with_fake_suggester([])
    try:
        result = pipe.run(_png_bytes(), "image/png", dish_hint=None,
                          plate_diameter_cm=26.0)
    finally:
        pipe._suggester = None
    assert result["status"] == "rejected"
    assert result["reason"] == "dish_unidentified"
    assert result["dish_suggestions"] == []


def test_unknown_hint_still_suggests():
    pipe = _pipeline_with_fake_suggester([
        {"food_id": "biryani_generic", "label": "Biryani", "score": 0.31},
    ])
    try:
        result = pipe.run(_png_bytes(), "image/png", dish_hint="not_a_dish",
                          plate_diameter_cm=26.0)
    finally:
        pipe._suggester = None
    assert result["status"] == "rejected"
    assert result["reason"] == "dish_unknown"
    assert len(result["dish_suggestions"]) == 1


def test_confirmed_hint_skips_suggestion():
    # A user-confirmed dish_hint goes straight to the estimate path (fixture
    # mode still rejects numbers, but the reason must not be dish-related).
    result = run_estimate(_png_bytes(), "image/png", dish_hint="biryani",
                          plate_diameter_cm=26.0)
    assert result["reason"] == "fixture_mode"
    assert result.get("dish_suggestions", []) == []
