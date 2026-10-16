"""WS4 hardening tests: rate limiting and metrics."""
from fastapi.testclient import TestClient

from app.main import create_app


def test_metrics_counts_requests():
    client = TestClient(create_app())
    client.get("/health")
    snap = client.get("/metrics").json()
    assert snap["requests_total"] >= 1
    assert snap["by_path"].get("/health", 0) >= 1
    assert "2xx" in snap["by_status_class"]


def test_rate_limit_returns_429_after_burst():
    app = create_app()
    # Tighten the limiter for the test: 5 requests/minute on this app.
    from app.core.middleware import RateLimitMiddleware

    app.user_middleware = [m for m in app.user_middleware
                           if m.cls is not RateLimitMiddleware]
    app.add_middleware(RateLimitMiddleware, rate_per_minute=5)
    app.middleware_stack = app.build_middleware_stack()
    client = TestClient(app)
    codes = [client.post("/api/v1/coach/query",
                         json={"user_id": "rl", "query_text": "hello",
                               "language": "en"}).status_code
             for _ in range(8)]
    assert 429 in codes, codes
    assert codes.index(429) >= 5  # the budget was served first


def test_cors_allows_local_frontend_dev_origins():
    """Waqas's frontend dev servers must not be CORS-blocked (collab setup)."""
    from app.core.config import Settings

    origins = Settings().cors_origin_list
    for expected in ("http://localhost:5173", "http://localhost:8081", "http://localhost:3000"):
        assert expected in origins
    assert "*" not in origins  # never wildcard-with-credentials


def _app_with_tight_limiter(rate_per_minute: int):
    """Fresh app with the production limiter swapped for a tight test one."""
    from app.core.middleware import RateLimitMiddleware

    app = create_app()
    app.user_middleware = [m for m in app.user_middleware
                           if m.cls is not RateLimitMiddleware]
    app.add_middleware(RateLimitMiddleware, rate_per_minute=rate_per_minute)
    app.middleware_stack = app.build_middleware_stack()
    return app


def _query(client, ip_headers):
    return client.post(
        "/api/v1/coach/query",
        json={"user_id": "rl", "query_text": "hello", "language": "en"},
        headers=ip_headers,
    ).status_code


def test_rate_limit_buckets_are_per_forwarded_ip():
    """Behind Caddy, request.client.host is the proxy — buckets must key on
    X-Forwarded-For (leftmost) instead, or every user shares one bucket."""
    client = TestClient(_app_with_tight_limiter(rate_per_minute=3))
    ip_a = {"X-Forwarded-For": "1.2.3.4"}
    ip_b = {"X-Forwarded-For": "5.6.7.8"}

    # Exhaust A's budget: 3 served, 4th rejected.
    assert [_query(client, ip_a) for _ in range(3)] != [429] * 3
    assert _query(client, ip_a) == 429

    # B is a different client: full budget intact.
    assert _query(client, ip_b) != 429
    assert _query(client, ip_b) != 429


def test_rate_limit_uses_leftmost_forwarded_ip():
    """With a chain of proxies, the original client is the leftmost entry."""
    client = TestClient(_app_with_tight_limiter(rate_per_minute=1))
    chain = {"X-Forwarded-For": "9.9.9.9, 10.0.0.1, 10.0.0.2"}
    assert _query(client, chain) != 429
    assert _query(client, chain) == 429  # second request from 9.9.9.9 rejected
    # A request apparently from the middle proxy gets its own bucket.
    assert _query(client, {"X-Forwarded-For": "10.0.0.1"}) != 429


def test_rate_limit_falls_back_to_direct_peer_without_xff():
    """No X-Forwarded-For header: fall back to the direct peer address."""
    client = TestClient(_app_with_tight_limiter(rate_per_minute=1))
    assert _query(client, {}) != 429
    assert _query(client, {}) == 429
