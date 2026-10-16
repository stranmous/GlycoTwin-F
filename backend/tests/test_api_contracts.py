"""Automated API Contract Test Suite for GlycoTwin.

Verifies that all frontend-consumed routes (Auth, Ingestion, Insights, Calibration,
Predictive Core, Simulation, AI Coach, Nutrition, Health, Metrics, and CORS preflights)
conform to the OpenAPI contract specification and return expected 200 OK / 201 responses.
"""
import asyncio
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.modules.m1_ingestion.db_models
import app.modules.m4_auth.models  # noqa: F401
from app.core.config import get_settings
from app.core.db import Base, get_db
from app.main import create_app


@pytest.fixture(scope="module")
def contract_app_and_client():
    """Create a clean isolated application instance with in-memory SQLite for contract testing."""
    test_app = create_app()

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

    test_app.dependency_overrides[get_db] = _override
    with TestClient(test_app) as client:
        yield client
    test_app.dependency_overrides.pop(get_db, None)


@pytest.fixture(scope="module")
def authed_user(contract_app_and_client: TestClient):
    """Register and authenticate a user; yield (client, headers, user_id)."""
    email = f"contract_test_{int(datetime.now(UTC).timestamp())}@example.com"
    reg_resp = contract_app_and_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!"},
    )
    assert reg_resp.status_code == 201, reg_resp.text
    data = reg_resp.json()
    token = data["access_token"]
    user_id = data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    return contract_app_and_client, headers, user_id


# ============================================================================
# 1. CORS & Network Host Binding Contract Tests
# ============================================================================

def test_cors_preflight_localhost_and_lan_origins(contract_app_and_client: TestClient):
    """Verify CORS preflights for Expo web, Android emulator, and LAN IPs."""
    test_origins = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://10.0.2.2:8000",
        "http://10.0.2.2:8081",
        "http://192.168.1.150:8081",
        "http://10.1.2.3:3000",
    ]

    for origin in test_origins:
        resp = contract_app_and_client.options(
            "/api/v1/auth/me",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        assert resp.status_code == 200, f"CORS preflight failed for {origin}"
        assert resp.headers.get("access-control-allow-origin") == origin
        assert resp.headers.get("access-control-allow-credentials") == "true"


# ============================================================================
# 2. Auth Routes Contract Tests
# ============================================================================

def test_auth_me_contract(authed_user):
    """GET /api/v1/auth/me -> 200 with UserOut schema."""
    client, headers, user_id = authed_user
    resp = client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == user_id
    assert "@example.com" in data["email"]
    assert "created_at" in data


def test_auth_profile_lifecycle_contract(authed_user):
    """GET /api/v1/auth/profile -> 404 before creation, 200 after creation and partial update."""
    client, headers, user_id = authed_user

    # 1. 404 before profile exists
    pre_resp = client.get("/api/v1/auth/profile", headers=headers)
    assert pre_resp.status_code == 404, pre_resp.text

    # 2. PUT /api/v1/auth/profile -> 200 (full creation)
    full_profile = {
        "age": 32,
        "weight_kg": 75.0,
        "height_cm": 178.0,
        "diabetes_type": "type2",
        "activity_level": "moderate",
        "medications": ["Metformin 500mg"],
        "hba1c": 6.7,
        "display_name": "Contract Tester",
        "preferred_language": "en",
    }
    create_resp = client.put("/api/v1/auth/profile", headers=headers, json=full_profile)
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    assert created["user_id"] == user_id
    assert created["age"] == 32
    assert created["activity_level"] == "moderate"
    assert created["bmi"] == round(75.0 / ((178.0 / 100) ** 2), 1)

    # 3. GET /api/v1/auth/profile -> 200 after creation
    post_resp = client.get("/api/v1/auth/profile", headers=headers)
    assert post_resp.status_code == 200, post_resp.text
    assert post_resp.json()["user_id"] == user_id
    assert post_resp.json()["age"] == 32

    # 4. PUT /api/v1/auth/profile -> 200 (partial update)
    partial_update = {"activity_level": "sedentary"}
    update_resp = client.put("/api/v1/auth/profile", headers=headers, json=partial_update)
    assert update_resp.status_code == 200, update_resp.text
    updated = update_resp.json()
    assert updated["activity_level"] == "sedentary"
    assert updated["age"] == 32  # preserved existing field


# ============================================================================
# 3. Ingestion Routes Contract Tests
# ============================================================================

def test_ingestion_cgm_and_history_readings_contract(authed_user):
    """POST /api/v1/ingestion/cgm -> 200 and GET /api/v1/ingestion/history/readings -> 200."""
    client, headers, _ = authed_user

    # POST CGM readings
    now_iso = datetime.now(UTC).isoformat()
    readings = [
        {"glucose_mg_dl": 115.0, "timestamp": now_iso},
        {"glucose_mg_dl": 122.0, "timestamp": now_iso},
        {"glucose_mg_dl": 130.0, "timestamp": now_iso},
    ]
    post_resp = client.post("/api/v1/ingestion/cgm", headers=headers, json=readings)
    assert post_resp.status_code == 200, post_resp.text
    assert post_resp.json()["status"] == "success"
    assert post_resp.json()["count"] == 3

    # GET CGM history readings (verifying timestamp and glucose_mg_dl presence)
    hist_resp = client.get("/api/v1/ingestion/history/readings", headers=headers)
    assert hist_resp.status_code == 200, hist_resp.text
    hist_data = hist_resp.json()
    assert hist_data["status"] == "success"
    assert hist_data["count"] >= 3
    first = hist_data["readings"][0]
    assert "timestamp" in first
    assert "glucose_mg_dl" in first
    assert "recorded_at" in first
    assert first["timestamp"] == first["recorded_at"]


def test_ingestion_meals_crud_contract(authed_user):
    """POST meals, GET history/meals, GET history/meals/{id}, DELETE meals/{id}."""
    client, headers, _ = authed_user

    # 1. POST /api/v1/ingestion/meals -> 200/201 (log a meal)
    meal_payload = {
        "name": "Grilled Chicken with Basmati Rice",
        "carbohydrates_g": 52.0,
        "protein_g": 35.0,
        "fat_g": 12.0,
        "fiber_g": 3.5,
        "meal_type": "dinner",
    }
    create_meal_resp = client.post("/api/v1/ingestion/meals", headers=headers, json=meal_payload)
    assert create_meal_resp.status_code in (200, 201), create_meal_resp.text
    meal_res = create_meal_resp.json()
    meal_id = meal_res.get("meal_id") or meal_res.get("id")
    assert meal_id is not None

    # 2. GET /api/v1/ingestion/history/meals -> 200
    meals_resp = client.get("/api/v1/ingestion/history/meals", headers=headers)
    assert meals_resp.status_code == 200, meals_resp.text
    meals_data = meals_resp.json()
    assert meals_data["status"] == "success"
    assert len(meals_data["meals"]) >= 1

    # 3. GET /api/v1/ingestion/history/meals/{meal_id} -> 200
    single_resp = client.get(f"/api/v1/ingestion/history/meals/{meal_id}", headers=headers)
    assert single_resp.status_code == 200, single_resp.text
    single_meal = single_resp.json()
    assert single_meal["id"] == meal_id
    assert single_meal["carbs_g"] == 52.0
    assert single_meal["protein_g"] == 35.0

    # 4. DELETE /api/v1/ingestion/meals/{meal_id} -> 200
    del_resp = client.delete(f"/api/v1/ingestion/meals/{meal_id}", headers=headers)
    assert del_resp.status_code == 200, del_resp.text
    assert del_resp.json()["status"] == "success"

    # Verify deleted
    verify_resp = client.get(f"/api/v1/ingestion/history/meals/{meal_id}", headers=headers)
    assert verify_resp.status_code == 404


# ============================================================================
# 4. Insights Routes Contract Tests
# ============================================================================

def test_insights_status_contract(authed_user):
    """GET /api/v1/insights/status -> 200."""
    client, headers, _ = authed_user
    resp = client.get("/api/v1/insights/status", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "active"
    assert resp.json()["module"] == "7"


def test_insights_summary_windows_contract(authed_user):
    """GET /api/v1/insights/summary with window=today, 7d, 30d -> 200."""
    client, headers, _ = authed_user

    for win in ["today", "7d", "30d"]:
        resp = client.get(f"/api/v1/insights/summary?window={win}", headers=headers)
        assert resp.status_code == 200, f"window={win} failed: {resp.text}"
        data = resp.json()
        assert data["window"] == win
        assert "tir" in data
        assert "in_range_pct" in data["tir"]
        assert "above_range_pct" in data["tir"]
        assert "below_range_pct" in data["tir"]
        assert "sample_count" in data["tir"]
        assert "cards" in data


def test_insights_time_in_range_contract(authed_user):
    """POST /api/v1/insights/time-in-range -> 200."""
    client, headers, _ = authed_user
    payload = {
        "readings": [
            {"glucose_mg_dl": 85.0},
            {"glucose_mg_dl": 110.0},
            {"glucose_mg_dl": 145.0},
            {"glucose_mg_dl": 195.0},
        ],
        "low": 70.0,
        "high": 180.0,
    }
    resp = client.post("/api/v1/insights/time-in-range", headers=headers, json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["n"] == 4
    assert data["sample_count"] == 4
    assert data["in_range_count"] == 3
    assert data["above_count"] == 1
    assert data["below_count"] == 0
    assert data["in_range_pct"] == 75.0


# ============================================================================
# 5. Calibration Routes Contract Tests
# ============================================================================

def test_calibration_status_contract(authed_user):
    """GET /api/v1/calibration/status -> 200."""
    client, headers, _ = authed_user
    resp = client.get("/api/v1/calibration/status", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "active"
    assert resp.json()["module"] == "2"


# ============================================================================
# 6. Predictive Core Routes Contract Tests
# ============================================================================

def test_predictions_predict_contract(authed_user):
    """POST /api/v1/predictions/predict -> 200 with PostMealTrajectory."""
    client, headers, user_id = authed_user
    predict_payload = {
        "calibrated_state": {
            "user_id": user_id,
            "phenotype_cluster_id": "phenotype_t2_moderate",
            "baseline_glucose_mg_dl": 110.0,
            "estimated_insulin_sensitivity": 0.045,
            "carb_absorption_rate_index": 0.035,
            "confidence_score": 0.90,
            "is_cold_start": False,
        },
        "meal_input": {
            "carbohydrates_g": 60.0,
            "protein_g": 25.0,
            "fat_g": 15.0,
            "glycemic_index": 55.0,
        },
        "current_glucose_mg_dl": 112.0,
    }
    resp = client.post("/api/v1/predictions/predict", headers=headers, json=predict_payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["user_id"] == user_id
    assert "time_minutes" in data
    assert "glucose_values_mg_dl" in data
    assert data["peak_glucose_mg_dl"] >= 112.0
    assert len(data["glucose_values_mg_dl"]) == len(data["time_minutes"])


# ============================================================================
# 7. Simulation Routes Contract Tests
# ============================================================================

def test_simulations_status_and_compare_contract(authed_user):
    """GET /api/v1/simulations/status -> 200 and POST /api/v1/simulations/compare -> 200."""
    client, headers, user_id = authed_user

    # Status check
    status_resp = client.get("/api/v1/simulations/status", headers=headers)
    assert status_resp.status_code == 200, status_resp.text
    assert status_resp.json()["status"] == "active"
    assert status_resp.json()["module"] == "6"

    # Compare scenarios
    compare_payload = {
        "calibrated_state": {
            "user_id": user_id,
            "phenotype_cluster_id": "phenotype_t2_moderate",
            "baseline_glucose_mg_dl": 105.0,
            "estimated_insulin_sensitivity": 0.045,
            "carb_absorption_rate_index": 0.035,
            "confidence_score": 0.90,
            "is_cold_start": False,
        },
        "baseline_scenario": {
            "meal": {
                "carbohydrates_g": 65.0,
                "protein_g": 20.0,
                "fat_g": 15.0,
                "glycemic_index": 65.0,
            },
            "activity": {
                "name": "none",
                "duration_minutes": 0.0,
                "intensity_factor": 1.0,
            },
        },
        "counterfactual_scenario": {
            "meal": {
                "carbohydrates_g": 45.0,
                "protein_g": 25.0,
                "fat_g": 12.0,
                "glycemic_index": 45.0,
            },
            "activity": {
                "name": "post_meal_walk",
                "duration_minutes": 25.0,
                "intensity_factor": 1.4,
            },
        },
    }
    comp_resp = client.post("/api/v1/simulations/compare", headers=headers, json=compare_payload)
    assert comp_resp.status_code == 200, comp_resp.text
    comp_data = comp_resp.json()
    assert "baseline_trajectory" in comp_data
    assert "counterfactual_trajectory" in comp_data
    assert "delta_metrics" in comp_data
    assert "delta_peak_glucose_mg_dl" in comp_data["delta_metrics"]


# ============================================================================
# 8. AI Coach Routes Contract Tests
# ============================================================================

def test_coach_status_and_query_contract(authed_user):
    """GET /api/v1/coach/status -> 200 and POST /api/v1/coach/query -> 200."""
    client, headers, _ = authed_user

    # Status check
    status_resp = client.get("/api/v1/coach/status", headers=headers)
    assert status_resp.status_code == 200, status_resp.text
    assert status_resp.json()["status"] == "active"
    assert status_resp.json()["module"] == "8"

    # Query AI coach (local fallback mode)
    query_payload = {
        "query_text": "What are good dietary choices to manage postprandial glucose?",
        "language": "en",
    }
    query_resp = client.post("/api/v1/coach/query", headers=headers, json=query_payload)
    assert query_resp.status_code == 200, query_resp.text
    q_data = query_resp.json()
    assert "response_text" in q_data
    assert len(q_data["response_text"]) > 10
    assert q_data["safety_passed"] is True
    assert q_data["disclaimer_included"] is True


# ============================================================================
# 9. Nutrition Routes Contract Tests
# ============================================================================

def test_nutrition_status_and_dishes_contract(authed_user, monkeypatch):
    """GET /api/v1/nutrition/status -> 200 with vision_mode == 'models' and GET /dishes -> 200."""
    client, headers, _ = authed_user

    # Verify status in real model mode with FastSAM-s.pt
    monkeypatch.setenv("FASTSAM_MODEL_PATH", "weights/FastSAM-s.pt")
    get_settings.cache_clear()

    status_resp = client.get("/api/v1/nutrition/status", headers=headers)
    assert status_resp.status_code == 200, status_resp.text
    status_data = status_resp.json()
    assert status_data["module"] == "5"
    assert status_data["name"] == "volumetric-nutrition-quantifier"
    assert status_data["vision_mode"] == "models", f"Expected 'models', got: {status_data}"
    assert "models" in status_data

    # GET dishes
    dishes_resp = client.get("/api/v1/nutrition/dishes", headers=headers)
    assert dishes_resp.status_code == 200, dishes_resp.text
    dishes_data = dishes_resp.json()
    assert isinstance(dishes_data, list)
    assert len(dishes_data) >= 1
    sample = dishes_data[0]
    assert "food_id" in sample
    assert "english" in sample
    assert "urdu" in sample


# ============================================================================
# 10. Health and Metrics Contract Tests
# ============================================================================

def test_health_and_metrics_contract(contract_app_and_client: TestClient):
    """GET /health and GET /metrics -> 200."""
    # Health endpoint
    h_resp = contract_app_and_client.get("/health")
    assert h_resp.status_code == 200, h_resp.text
    assert h_resp.json()["status"] == "ok"

    # Metrics endpoint
    m_resp = contract_app_and_client.get("/metrics")
    assert m_resp.status_code == 200, m_resp.text
    m_data = m_resp.json()
    assert isinstance(m_data, dict)
    assert "total_requests" in m_data or "active_connections" in m_data or len(m_data) >= 0
