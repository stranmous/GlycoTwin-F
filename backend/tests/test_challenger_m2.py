"""Challenger Milestone 2 empirical stress test suite.

Covers:
1. GET /api/v1/insights/summary:
   - window="today", "7d", "30d", and invalid fallback.
   - User with 0 readings/meals (cold-start canonical defaults).
   - User with readings and meals (computed TIR, window filtering, top spike meals, avg peaks, warning cards).
2. PUT /api/v1/auth/profile:
   - Partial update {"activity_level": "moderate"} on cold start (200 OK + defaults).
   - Partial update on existing profile (preserves other fields, recalculates BMI) [BUG TEST].
   - Medications array with dicts [{"name": "Metformin", "dose": "500mg"}].
   - Medications array with strings ["Metformin 500mg", "Insulin"].
   - display_name and preferred_language updates [BUG TEST].
   - Validation bounds (negative/excessive age, zero weight, extreme hba1c).
3. GET /api/v1/ingestion/history/readings:
   - Empty history returns count 0.
   - Populated history contains timestamp alongside recorded_at with timestamp == recorded_at.
   - Ordering newest first and limit controls.
4. Auxiliary M2 schemas:
   - TimeInRangeResponse sample_count synced from n.
   - SimulationDeltaMetrics delta_tar_min.
"""
import asyncio
from datetime import UTC, datetime, timedelta
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.modules.m1_ingestion.db_models
import app.modules.m4_auth.models
from app.core.db import Base, get_db
from app.main import app
from app.modules.m6_simulation.schemas import SimulationDeltaMetrics


@pytest.fixture(scope="module")
def ch_client(client):
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    async def _setup() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_setup())
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    async def _override():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override
    yield client
    app.dependency_overrides.pop(get_db, None)


def _register_user(client, email_prefix: str):
    email = f"{email_prefix}_{datetime.now().timestamp()}@test.com"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password-12345"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    user_id = r.json()["user"]["id"]
    return user_id, {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------
# 1. GET /api/v1/insights/summary
# ----------------------------------------------------

def test_insights_summary_cold_start_all_windows(ch_client):
    """Verify fallback defaults for user with zero readings and zero meals."""
    _, headers = _register_user(ch_client, "cold_start")

    for win in ["today", "7d", "30d", "unsupported", ""]:
        res = ch_client.get(f"/api/v1/insights/summary?window={win}", headers=headers)
        assert res.status_code == 200, f"Failed for window={win}: {res.text}"
        data = res.json()
        expected_window = win if win in ["7d", "30d"] else "today"
        assert data["window"] == expected_window
        assert data["tir"]["in_range_pct"] == 85.0
        assert data["tir"]["above_range_pct"] == 10.0
        assert data["tir"]["below_range_pct"] == 5.0
        assert data["tir"]["sample_count"] == 288
        assert data["tir"]["mean_mg_dl"] == 118.0
        assert data["tir"]["gmi_pct"] == 6.1
        assert data["avg_peak_by_meal_type"] == {
            "breakfast": 142.0,
            "lunch": 155.0,
            "dinner": 160.0,
        }
        assert data["top_spike_meals"] == []
        assert len(data["cards"]) == 2
        assert data["cards"][0]["severity"] == "good"
        assert data["cards"][1]["severity"] == "info"
        assert data["cards"][0]["title_en"]
        assert data["cards"][0]["title_ur"]


def test_insights_summary_with_active_readings_and_meals(ch_client):
    """Verify computed metrics, window cutoff filtering, spike ranking, and alert cards."""
    _, headers = _register_user(ch_client, "active_user")
    now = datetime.now(UTC)

    # 1. Ingest 10 CGM readings within today
    cgm_today = [
        {"glucose_mg_dl": val, "timestamp": (now - timedelta(hours=2)).isoformat(), "source": "cgm"}
        for val in [100.0, 110.0, 120.0, 130.0, 140.0, 150.0, 210.0, 220.0, 230.0, 60.0]
    ]
    post_cgm = ch_client.post("/api/v1/ingestion/cgm", json=cgm_today, headers=headers)
    assert post_cgm.status_code == 200

    # 2. Ingest 1 CGM reading older than 2 days (48 hours ago)
    cgm_old = [
        {"glucose_mg_dl": 300.0, "timestamp": (now - timedelta(days=2)).isoformat(), "source": "cgm"}
    ]
    post_cgm_old = ch_client.post("/api/v1/ingestion/cgm", json=cgm_old, headers=headers)
    assert post_cgm_old.status_code == 200

    # 3. Ingest 6 meals across breakfast (8am), lunch (13pm), and dinner (19pm, 20pm, 21pm, 22pm)
    meals = [
        {"dish_label": "Oatmeal", "carbohydrates_g": 40.0, "protein_g": 10.0, "fat_g": 5.0, "timestamp": (now.replace(hour=8, minute=0, second=0)).isoformat()},
        {"dish_label": "Biryani", "carbohydrates_g": 90.0, "protein_g": 30.0, "fat_g": 20.0, "timestamp": (now.replace(hour=13, minute=0, second=0)).isoformat()},
        {"dish_label": "Nihari", "carbohydrates_g": 110.0, "protein_g": 35.0, "fat_g": 25.0, "timestamp": (now.replace(hour=19, minute=0, second=0)).isoformat()},
        {"dish_label": "Kheer", "carbohydrates_g": 70.0, "protein_g": 5.0, "fat_g": 10.0, "timestamp": (now.replace(hour=20, minute=0, second=0)).isoformat()},
        {"dish_label": "Late Snack", "carbohydrates_g": 20.0, "protein_g": 2.0, "fat_g": 2.0, "timestamp": (now.replace(hour=22, minute=0, second=0)).isoformat()},
        {"dish_label": "Extra Dinner", "carbohydrates_g": 80.0, "protein_g": 15.0, "fat_g": 10.0, "timestamp": (now.replace(hour=21, minute=0, second=0)).isoformat()},
    ]
    for m in meals:
        res_m = ch_client.post("/api/v1/ingestion/meal", json=m, headers=headers)
        assert res_m.status_code == 200, res_m.text

    # Test window=today
    res_today = ch_client.get("/api/v1/insights/summary?window=today", headers=headers)
    assert res_today.status_code == 200
    s_today = res_today.json()

    # The 2-day-old reading of 300 should be excluded from today
    assert s_today["tir"]["sample_count"] == 10
    assert s_today["tir"]["in_range_pct"] == 60.0
    assert s_today["tir"]["above_range_pct"] == 30.0
    assert s_today["tir"]["below_range_pct"] == 10.0
    assert s_today["tir"]["mean_mg_dl"] == 147.0

    # Above range > 20% triggers alert card c3
    assert len(s_today["cards"]) == 3
    assert s_today["cards"][2]["id"] == "c3"
    assert s_today["cards"][2]["severity"] == "warn"
    assert "30.0%" in s_today["cards"][2]["body_en"]

    # Top spike meals capped at 5 and sorted descending
    spikes = s_today["top_spike_meals"]
    assert len(spikes) == 5
    for i in range(len(spikes) - 1):
        assert spikes[i]["peak_mgdl"] >= spikes[i + 1]["peak_mgdl"]

    # Meal type averages present
    assert s_today["avg_peak_by_meal_type"]["breakfast"] == 136.0
    assert s_today["avg_peak_by_meal_type"]["lunch"] == 181.0
    assert "dinner" in s_today["avg_peak_by_meal_type"]

    # Test window=7d includes the older reading (11 total readings)
    res_7d = ch_client.get("/api/v1/insights/summary?window=7d", headers=headers)
    assert res_7d.status_code == 200
    s_7d = res_7d.json()
    assert s_7d["tir"]["sample_count"] == 11


# ----------------------------------------------------
# 2. PUT /api/v1/auth/profile
# ----------------------------------------------------

def test_profile_partial_update_on_cold_start(ch_client):
    """Partial update on initial profile creation should succeed with defaults."""
    _, headers = _register_user(ch_client, "cold_profile")
    res = ch_client.put("/api/v1/auth/profile", headers=headers, json={"activity_level": "moderate"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["activity_level"] == "moderate"
    assert data["age"] == 35
    assert data["weight_kg"] == 70.0
    assert data["height_cm"] == 170.0
    assert data["diabetes_type"] == "type2"
    assert data["bmi"] == 24.2


@pytest.mark.xfail(
    reason="CRITICAL DEFECT: ProfileIn defaults clobber existing profile fields on partial update (e.g. age resets to 35, diabetes_type to type2, medications wiped to empty list)",
    strict=False,
)
def test_profile_partial_update_preserves_existing_data(ch_client):
    """
    BUG REPRODUCTION: Partial update on an existing profile must preserve
    existing customized fields (e.g. age=55, diabetes_type='type1', custom medications).
    Currently FAILS because ProfileIn default values clobber existing data.
    """
    _, headers = _register_user(ch_client, "clobber_audit")
    setup_payload = {
        "age": 55,
        "weight_kg": 80.0,
        "height_cm": 180.0,
        "diabetes_type": "type1",
        "activity_level": "sedentary",
        "medications": [{"name": "Insulin Lispro", "dose": "10 units"}],
    }
    setup_res = ch_client.put("/api/v1/auth/profile", headers=headers, json=setup_payload)
    assert setup_res.status_code == 200

    # Partial update: user only updates activity_level
    update_res = ch_client.put("/api/v1/auth/profile", headers=headers, json={"activity_level": "active"})
    assert update_res.status_code == 200
    update_data = update_res.json()

    # The user's custom age, diabetes_type, and medications MUST NOT be overwritten by defaults
    assert update_data["activity_level"] == "active"
    assert update_data["age"] == 55, f"Bug: age was clobbered to {update_data['age']} (expected 55)"
    assert update_data["diabetes_type"] == "type1", f"Bug: diabetes_type was clobbered to {update_data['diabetes_type']} (expected type1)"
    assert len(update_data["medications"]) == 1, f"Bug: medications was wiped to {update_data['medications']}"


@pytest.mark.xfail(
    reason="DEFECT: display_name sent in PUT /api/v1/auth/profile is not persisted and is returned as None in ProfileOut",
    strict=False,
)
def test_profile_display_name_persisted_and_returned(ch_client):
    """
    BUG REPRODUCTION: display_name sent in PUT /api/v1/auth/profile must be
    returned in ProfileOut and retrievable via GET /api/v1/auth/profile.
    Currently FAILS because ProfileOut returns display_name: None and it is not persisted.
    """
    _, headers = _register_user(ch_client, "display_name_test")
    res = ch_client.put("/api/v1/auth/profile", headers=headers, json={
        "display_name": "Fatima Zahra",
    })
    assert res.status_code == 200
    assert res.json()["display_name"] == "Fatima Zahra", f"Bug: PUT profile returned display_name={res.json().get('display_name')}"

    get_res = ch_client.get("/api/v1/auth/profile", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["display_name"] == "Fatima Zahra", f"Bug: GET profile returned display_name={get_res.json().get('display_name')}"


def test_profile_medications_formats(ch_client):
    """Medications array accepts both dict items and string items."""
    _, headers = _register_user(ch_client, "meds_user")

    # Dict format
    med_dicts = [{"name": "Metformin", "dose": "500mg"}, {"name": "Empagliflozin", "dose": "10mg"}]
    res1 = ch_client.put("/api/v1/auth/profile", headers=headers, json={"medications": med_dicts})
    assert res1.status_code == 200
    assert res1.json()["medications"] == med_dicts

    # String format
    med_strings = ["Metformin 500mg twice daily", "Glargine 10 units"]
    res2 = ch_client.put("/api/v1/auth/profile", headers=headers, json={"medications": med_strings})
    assert res2.status_code == 200
    assert res2.json()["medications"] == med_strings


def test_profile_language_handling(ch_client):
    """preferred_language updates active_language on User."""
    _, headers = _register_user(ch_client, "lang_user")
    res = ch_client.put("/api/v1/auth/profile", headers=headers, json={
        "preferred_language": "ur",
    })
    assert res.status_code == 200
    res_me = ch_client.get("/api/v1/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["active_language"] == "ur"


def test_profile_boundary_validation_rejections(ch_client):
    """Profile validation rejects out-of-range physiological values."""
    _, headers = _register_user(ch_client, "validation_user")
    assert ch_client.put("/api/v1/auth/profile", headers=headers, json={"age": -1}).status_code == 422
    assert ch_client.put("/api/v1/auth/profile", headers=headers, json={"age": 125}).status_code == 422
    assert ch_client.put("/api/v1/auth/profile", headers=headers, json={"weight_kg": 0}).status_code == 422
    assert ch_client.put("/api/v1/auth/profile", headers=headers, json={"height_cm": 0}).status_code == 422
    assert ch_client.put("/api/v1/auth/profile", headers=headers, json={"hba1c": 22.0}).status_code == 422


# ----------------------------------------------------
# 3. GET /api/v1/ingestion/history/readings
# ----------------------------------------------------

def test_reading_history_timestamp_and_recorded_at(ch_client):
    """Verify timestamp alias, recorded_at, values, and newest-first order."""
    _, headers = _register_user(ch_client, "reading_history_user")
    now = datetime.now(UTC)

    # 1. Empty readings
    empty_res = ch_client.get("/api/v1/ingestion/history/readings", headers=headers)
    assert empty_res.status_code == 200
    assert empty_res.json()["count"] == 0
    assert empty_res.json()["readings"] == []

    # 2. Ingest 3 distinct timestamped readings
    payload = [
        {"glucose_mg_dl": 105.0, "timestamp": (now - timedelta(minutes=20)).isoformat(), "source": "cgm"},
        {"glucose_mg_dl": 125.0, "timestamp": (now - timedelta(minutes=10)).isoformat(), "source": "cgm"},
        {"glucose_mg_dl": 140.0, "timestamp": now.isoformat(), "source": "cgm"},
    ]
    post_res = ch_client.post("/api/v1/ingestion/cgm", json=payload, headers=headers)
    assert post_res.status_code == 200

    # 3. Fetch history
    get_res = ch_client.get("/api/v1/ingestion/history/readings", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["status"] == "success"
    assert data["count"] == 3
    readings = data["readings"]
    assert len(readings) == 3

    for r in readings:
        assert "timestamp" in r, "Missing 'timestamp' field"
        assert "recorded_at" in r, "Missing 'recorded_at' field"
        assert r["timestamp"] == r["recorded_at"], "timestamp must match recorded_at"
        assert isinstance(r["glucose_mg_dl"], float)
        assert r["source"] == "cgm"

    # Newest first
    assert readings[0]["glucose_mg_dl"] == 140.0
    assert readings[1]["glucose_mg_dl"] == 125.0
    assert readings[2]["glucose_mg_dl"] == 105.0

    # Test limit parameter
    limit_res = ch_client.get("/api/v1/ingestion/history/readings?limit=2", headers=headers)
    assert limit_res.status_code == 200
    assert len(limit_res.json()["readings"]) == 2


# ----------------------------------------------------
# 4. Auxiliary M2 Schemas
# ----------------------------------------------------

def test_auxiliary_m2_schemas(ch_client):
    """Verify sample_count in TimeInRangeResponse and delta_tar_min in SimulationDeltaMetrics."""
    _, headers = _register_user(ch_client, "aux_user")
    tir_res = ch_client.post(
        "/api/v1/insights/time-in-range",
        headers=headers,
        json={"readings": [{"glucose_mg_dl": 95.0}, {"glucose_mg_dl": 130.0}]},
    )
    assert tir_res.status_code == 200
    tir_body = tir_res.json()
    assert tir_body["n"] == 2
    assert tir_body["sample_count"] == 2

    # SimulationDeltaMetrics
    delta_explicit = SimulationDeltaMetrics(
        delta_peak_glucose_mg_dl=-20.0,
        delta_iauc_mg_dl_min=-400.0,
        delta_time_to_peak_minutes=15,
        delta_tar_min=-10.0,
    )
    assert delta_explicit.delta_tar_min == -10.0

    delta_default = SimulationDeltaMetrics(
        delta_peak_glucose_mg_dl=0.0,
        delta_iauc_mg_dl_min=0.0,
        delta_time_to_peak_minutes=0,
    )
    assert delta_default.delta_tar_min == 0.0
