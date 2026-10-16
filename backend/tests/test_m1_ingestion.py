"""M1 tests — ingestion, CGM reading history with timestamp, and meal history."""
from datetime import UTC, datetime


def test_ingestion_status(client):
    r = client.get("/api/v1/ingestion/status")
    assert r.status_code == 200
    assert r.json()["status"] == "active"


def test_reading_history_timestamp_and_cgm_flow(authed_client):
    client, headers = authed_client

    # Ingest CGM readings
    now_iso = datetime.now(UTC).isoformat()
    cgm_payload = [
        {"glucose_mg_dl": 110.0, "timestamp": now_iso, "source": "cgm"},
        {"glucose_mg_dl": 125.0, "timestamp": now_iso, "source": "cgm"},
    ]
    post_res = client.post("/api/v1/ingestion/cgm", json=cgm_payload, headers=headers)

    assert post_res.status_code == 200, post_res.text

    # Read history and assert timestamp alias is present alongside recorded_at
    get_res = client.get("/api/v1/ingestion/history/readings", headers=headers)
    assert get_res.status_code == 200, get_res.text
    body = get_res.json()
    assert body["status"] == "success"
    assert body["count"] >= 2
    for reading in body["readings"]:
        assert "glucose_mg_dl" in reading
        assert "recorded_at" in reading
        assert "timestamp" in reading
        assert reading["timestamp"] == reading["recorded_at"]


def test_meal_history_and_deletion(authed_client):
    client, headers = authed_client
    meal_data = {
        "dish_label": "Chicken Biryani",
        "carbs_g": 65.0,
        "protein_g": 30.0,
        "fat_g": 18.0,
        "fiber_g": 3.0,
        "logged_at": datetime.now(UTC).isoformat(),
        "source": "manual",
    }
    r = client.post("/api/v1/ingestion/meal", json=meal_data, headers=headers)
    assert r.status_code == 200, r.text
    meal_id = r.json()["id"]

    # Retrieve history
    r_hist = client.get("/api/v1/ingestion/history/meals", headers=headers)
    assert r_hist.status_code == 200
    meals = r_hist.json()["meals"]
    assert any(m["id"] == meal_id for m in meals)

    # Delete meal
    del_r = client.delete(f"/api/v1/ingestion/meals/{meal_id}", headers=headers)
    assert del_r.status_code == 200
    assert del_r.json()["status"] == "success"
