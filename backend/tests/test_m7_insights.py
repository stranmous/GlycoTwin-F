"""M7 tests — Time-in-Range, the report's primary insight metric (70–180)."""
from app.modules.m7_insights.service import compute_time_in_range

SERIES = [60.0, 100.0, 180.0, 200.0, 70.0]  # below, in, in(boundary), above, in(boundary)


def test_time_in_range_exact_split():
    out = compute_time_in_range(SERIES)
    assert out["n"] == 5
    assert out["below_pct"] == 20.0
    assert out["in_range_pct"] == 60.0
    assert out["above_pct"] == 20.0
    assert out["mean_mg_dl"] == 122.0
    assert out["gmi_pct"] == 6.23  # 3.31 + 0.02392 * 122
    assert out["sd_mg_dl"] > 0 and out["cv_pct"] > 0


def test_time_in_range_custom_thresholds():
    out = compute_time_in_range(SERIES, low=90, high=140)
    assert out["in_range_count"] == 1  # only 100


def test_time_in_range_rejects_bad_input():
    import pytest

    with pytest.raises(ValueError):
        compute_time_in_range([])
    with pytest.raises(ValueError):
        compute_time_in_range(SERIES, low=180, high=70)


def test_api_time_in_range(authed_client):
    client, headers = authed_client
    r = client.post("/api/v1/insights/time-in-range",
                    json={"readings": [{"glucose_mg_dl": v} for v in SERIES]},
                    headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["in_range_pct"] == 60.0
    assert data["sample_count"] == 5

    assert client.post("/api/v1/insights/time-in-range",
                       json={"readings": []},
                       headers=headers).status_code == 422
    assert client.post("/api/v1/insights/time-in-range",
                       json={"readings": [{"glucose_mg_dl": 100}],
                             "low": 200, "high": 100},
                       headers=headers).status_code == 422


def test_insights_summary_default_fallback(authed_client):
    client, headers = authed_client
    r = client.get("/api/v1/insights/summary?window=today", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["window"] == "today"
    assert "tir" in data
    assert data["tir"]["in_range_pct"] == 85.0
    assert data["tir"]["sample_count"] == 288
    assert "avg_peak_by_meal_type" in data
    assert "breakfast" in data["avg_peak_by_meal_type"]
    assert "top_spike_meals" in data
    assert "cards" in data
    assert len(data["cards"]) >= 2
    assert "title_en" in data["cards"][0]
    assert "title_ur" in data["cards"][0]


def test_insights_summary_windows(authed_client):
    client, headers = authed_client
    for w in ("today", "7d", "30d"):
        r = client.get(f"/api/v1/insights/summary?window={w}", headers=headers)
        assert r.status_code == 200
        assert r.json()["window"] == w

