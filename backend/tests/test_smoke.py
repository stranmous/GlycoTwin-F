"""Harness smoke tests: every mounted module answers, and the M1→M3 chain
produces a physiologically sane 2-hour trajectory. These are the first rung
of the verification ladder (see docs/HARNESS.md) — they must stay green."""


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_module_status_endpoints(client):
    for path in ("/api/v1/ingestion/status", "/api/v1/calibration/status",
                 "/api/v1/predictions/status", "/api/v1/simulations/status",
                 "/api/v1/nutrition/status", "/api/v1/auth/status",
                 "/api/v1/insights/status", "/api/v1/coach/status"):
        r = client.get(path)
        assert r.status_code == 200, path
        assert r.json()["status"] == "active", path


def test_m1_ingest_cgm(authed_client):
    client, headers = authed_client
    readings = [
        {"timestamp": "2026-10-10T08:00:00Z", "glucose_mg_dl": 95.0},
        {"timestamp": "2026-10-10T08:05:00Z", "glucose_mg_dl": 98.0},
        {"timestamp": "2026-10-10T08:10:00Z", "glucose_mg_dl": 101.0},
    ]
    r = client.post("/api/v1/ingestion/cgm", json=readings, headers=headers)
    assert r.status_code == 200
    # the twin remembers: readings persist and are retrievable
    r = client.get("/api/v1/ingestion/history/readings", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["count"] >= 3


def test_m1_ingest_meal_persists(authed_client):
    client, headers = authed_client
    meal = {"timestamp": "2026-10-10T08:00:00Z", "carbohydrates_g": 60.0,
            "protein_g": 10.0, "fat_g": 5.0, "name": "biryani"}
    r = client.post("/api/v1/ingestion/meal", json=meal, headers=headers)
    assert r.status_code == 200, r.text
    r = client.get("/api/v1/ingestion/history/meals", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["count"] >= 1
    assert r.json()["meals"][0]["dish_label"] == "biryani"


def test_protected_routes_reject_anonymous(client):
    """Phase D: predict/simulate/coach/ingest are closed without a token."""
    for method, path, kwargs in [
        ("post", "/api/v1/predictions/predict", {"json": {}}),
        ("post", "/api/v1/simulations/compare", {"json": {}}),
        ("post", "/api/v1/coach/query",
         {"json": {"user_id": "x", "query_text": "hello"}}),
        ("post", "/api/v1/ingestion/cgm", {"json": []}),
        ("post", "/api/v1/ingestion/meal", {"json": {}}),
    ]:
        r = getattr(client, method)(path, **kwargs)
        assert r.status_code in (401, 403), (path, r.status_code)


def _calibrate(authed_client) -> tuple[dict, dict]:
    """Run M2 calibration the way the real flow does (the M2->M3 chain test
    exists because the two modules once disagreed on parameter units and
    every prediction crashed to the 20 mg/dL floor)."""
    client, headers = authed_client
    readings = [
        {"timestamp": f"2026-10-10T08:{m:02d}:00Z", "glucose_mg_dl": 100.0}
        for m in range(0, 60, 5)
    ]
    payload = {
        "user_id": "harness-user",
        "user_profile": {"user_id": "harness-user", "age": 30, "bmi": 24.0,
                         "diabetic_type": "type_2"},
        "cgm_readings": readings,
        "meal_records": [],
    }
    r = client.post("/api/v1/calibration/calibrate", json=payload,
                    headers=headers)
    assert r.status_code == 200, r.text
    return r.json(), headers


def test_m3_prediction_is_physiological(authed_client):
    state, headers = _calibrate(authed_client)
    client = authed_client[0]
    baseline = state["baseline_glucose_mg_dl"]
    payload = {
        "calibrated_state": state,
        "meal_input": {
            "carbohydrates_g": 60.0, "protein_g": 10.0,
            "fat_g": 5.0, "glycemic_index": 70.0,
        },
    }
    r = client.post("/api/v1/predictions/predict", json=payload,
                    headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    values = body["glucose_values_mg_dl"]
    assert len(values) == 25  # 0..120 min every 5 min
    assert len(body["time_minutes"]) == 25
    assert all(20.0 <= v <= 600.0 for v in values)  # hard physiological clamp
    # A 60 g carb meal must raise glucose meaningfully above baseline...
    assert body["peak_glucose_mg_dl"] >= baseline + 20.0
    assert 0 < body["time_to_peak_minutes"] < 120
    # ...and the curve must settle back toward baseline, never crash.
    assert abs(values[-1] - baseline) <= 25.0
    assert min(values) >= baseline - 15.0
    # Confidence band must bracket the curve.
    for v, lo, hi in zip(values, body["confidence_interval_lower"],
                         body["confidence_interval_upper"]):
        assert lo <= v <= hi


def test_m6_what_if_reduces_peak(authed_client):
    """The report's M6 promise: halve the portion, add a walk -> lower peak
    and lower iAUC than baseline. If this ever goes red, the what-if engine
    is lying to users."""
    state, headers = _calibrate(authed_client)
    client = authed_client[0]
    meal = {"carbohydrates_g": 60.0, "protein_g": 10.0,
            "fat_g": 5.0, "glycemic_index": 70.0}
    payload = {
        "calibrated_state": state,
        "baseline_scenario": {"meal": meal, "activity": {"name": "none"}},
        "counterfactual_scenario": {
            "meal": {**meal, "carbohydrates_g": 30.0},
            "activity": {"name": "walk", "duration_minutes": 15.0,
                         "intensity_factor": 1.0},
        },
    }
    r = client.post("/api/v1/simulations/compare", json=payload,
                    headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["delta_metrics"]["delta_peak_glucose_mg_dl"] < 0
    assert body["delta_metrics"]["delta_iauc_mg_dl_min"] < 0
    assert body["counterfactual_metrics"]["peak_glucose_mg_dl"] < \
        body["baseline_metrics"]["peak_glucose_mg_dl"]
