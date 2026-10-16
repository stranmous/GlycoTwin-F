"""Production middleware (WS4): per-IP rate limiting and request metrics.

Rate limiting is a simple in-process token bucket keyed by client IP —
appropriate for a single-instance deployment; a multi-instance deploy
swaps the bucket store for Redis without changing the call sites.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_EXEMPT_PREFIXES = ("/health", "/metrics", "/docs", "/openapi.json")


class Metrics:
    """Thread-safe in-memory counters, exposed at GET /metrics."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.requests_total = 0
        self.by_status_class: dict[str, int] = defaultdict(int)
        self.by_path: dict[str, int] = defaultdict(int)
        self.total_latency_ms = 0.0

    def record(self, path: str, status: int, latency_ms: float) -> None:
        with self._lock:
            self.requests_total += 1
            self.by_status_class[f"{status // 100}xx"] += 1
            self.by_path[path] += 1
            self.total_latency_ms += latency_ms

    def snapshot(self) -> dict:
        with self._lock:
            n = self.requests_total
            return {
                "requests_total": n,
                "by_status_class": dict(self.by_status_class),
                "by_path": dict(self.by_path),
                "mean_latency_ms": round(self.total_latency_ms / n, 2) if n else 0.0,
            }


METRICS = Metrics()


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        METRICS.record(request.url.path, response.status_code,
                       (time.perf_counter() - start) * 1000.0)
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token bucket per client IP: `rate` requests/minute, burst = rate."""

    def __init__(self, app, rate_per_minute: int = 120):
        super().__init__(app)
        self.capacity = float(rate_per_minute)
        self.refill_per_second = rate_per_minute / 60.0
        self._buckets: dict[str, tuple[float, float]] = {}
        self._lock = threading.Lock()

    def _allow(self, client: str) -> bool:
        now = time.monotonic()
        with self._lock:
            tokens, last = self._buckets.get(client, (self.capacity, now))
            tokens = min(self.capacity, tokens + (now - last) * self.refill_per_second)
            if tokens >= 1.0:
                self._buckets[client] = (tokens - 1.0, now)
                return True
            self._buckets[client] = (tokens, now)
            return False

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith(_EXEMPT_PREFIXES):
            return await call_next(request)
        client = _client_ip(request)
        if not self._allow(client):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Slow down and retry shortly."},
                headers={"Retry-After": "30"},
            )
        return await call_next(request)


def _client_ip(request: Request) -> str:
    """Best-effort original client IP.

    Behind Caddy (or any reverse proxy) ``request.client.host`` is the proxy
    itself, which would collapse every user into one shared rate-limit
    bucket. Trust the leftmost entry of ``X-Forwarded-For`` (the original
    client as seen by the outermost proxy) and fall back to the direct
    peer address when the header is absent.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"
