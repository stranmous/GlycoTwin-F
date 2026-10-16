"""Simulation result cache: Redis when reachable, in-memory fallback otherwise.

Ported from GlycoTwin-AI-Core's app/cache/redis_client.py (which already had
the right idea: caching is an optimization, never a hard dependency). The URL
now comes from Settings instead of a raw environment read.
"""
import hashlib
import json
import threading
import time
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("glycotwin.cache")


class InMemoryCache:
    """In-memory key-value cache with TTL expiration."""

    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expire_at = entry
        if time.time() > expire_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        self._store[key] = (value, time.time() + ttl_seconds)

    def clear(self) -> None:
        self._store.clear()


class SimulationCache:
    """Caches M6 comparison results keyed by a hash of the request."""

    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or get_settings().redis_url
        self._redis_client = None
        self._in_memory_cache = InMemoryCache()
        self.backend_type = "in_memory"
        self._init_redis()

    def _init_redis(self):
        try:
            import redis

            client = redis.Redis.from_url(self.redis_url, socket_timeout=1.0)
            client.ping()
            self._redis_client = client
            self.backend_type = "redis"
        except Exception:  # noqa: BLE001 — cache is best-effort by design
            self._redis_client = None
            log.info("Redis unreachable at %s — cache running in-memory",
                     self.redis_url)

    def _make_key(self, prefix: str, request_data: Any) -> str:
        if hasattr(request_data, "model_dump_json"):
            serialized = request_data.model_dump_json()
        elif isinstance(request_data, dict):
            serialized = json.dumps(request_data, sort_keys=True)
        else:
            serialized = str(request_data)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return f"glycotwin:cache:{prefix}:{digest}"

    def get_simulation_result(self, prefix: str, request_data: Any) -> dict | None:
        key = self._make_key(prefix, request_data)
        if self._redis_client:
            try:
                cached = self._redis_client.get(key)
                if cached:
                    return json.loads(cached)
            except Exception:
                log.debug("cache get failed; treating as miss", exc_info=True)
        return self._in_memory_cache.get(key)

    def set_simulation_result(
        self, prefix: str, request_data: Any, result_data: Any, ttl_seconds: int = 300
    ) -> None:
        key = self._make_key(prefix, request_data)
        if hasattr(result_data, "model_dump"):
            payload = result_data.model_dump(mode="json")
        elif isinstance(result_data, dict):
            payload = result_data
        else:
            payload = result_data
        if self._redis_client:
            try:
                self._redis_client.setex(
                    key, ttl_seconds, json.dumps(payload, default=str))
            except Exception:
                log.debug("cache set failed; continuing without Redis", exc_info=True)
        self._in_memory_cache.set(key, payload, ttl_seconds)

    def clear(self) -> None:
        if self._redis_client:
            try:
                self._redis_client.flushdb()
            except Exception:
                log.debug("cache clear failed", exc_info=True)
        self._in_memory_cache.clear()


_cache_instance: SimulationCache | None = None
_cache_lock = threading.Lock()


def get_simulation_cache() -> SimulationCache:
    """Build the cache on first use — importing this module must not touch
    the network (the Redis connect in SimulationCache.__init__ is deferred)."""
    global _cache_instance
    if _cache_instance is None:
        with _cache_lock:
            if _cache_instance is None:
                _cache_instance = SimulationCache()
    return _cache_instance


class _LazySimulationCache:
    """Module-level stand-in for ``simulation_cache``.

    Attribute access builds the real SimulationCache on first use, so
    ``from app.core.cache import simulation_cache`` stays import-safe.
    setattr lands on the proxy (so tests can monkeypatch methods on it).
    """

    def __init__(self) -> None:
        object.__setattr__(self, "_instance", None)

    def _real(self) -> SimulationCache:
        inst = object.__getattribute__(self, "_instance")
        if inst is None:
            inst = get_simulation_cache()
            object.__setattr__(self, "_instance", inst)
        return inst

    def __getattr__(self, name: str) -> Any:
        return getattr(self._real(), name)


simulation_cache = _LazySimulationCache()
