"""Import-time side-effect tests: the mentor flagged import-time singletons
(the Redis connect, the M3 residual selection, the M8 LLM provider).

Importing these modules must perform no network I/O, and the expensive
objects must not be built until first use. The subprocess test below is the
real proof (fresh interpreter, socket.connect blocked); the in-process test
pins the lazy-proxy wiring.
"""
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

_IMPORT_PROBE = (
    "import socket\n"
    "calls = []\n"
    "def _spy(self, addr):\n"
    "    calls.append(addr)\n"
    "    raise OSError('network blocked in test')\n"
    "socket.socket.connect = _spy\n"
    "import app.core.cache as _cache\n"
    "import app.modules.m3_predictive_core.service as _m3\n"
    "import app.modules.m8_coach.service as _m8\n"
    "assert _cache._cache_instance is None, 'cache built at import'\n"
    "assert _m3._residual_model is None, 'residual built at import'\n"
    "assert _m8.llm_provider._instance is None, 'LLM provider built at import'\n"
    "raise SystemExit(1 if calls else 0)\n"
)


def test_imports_perform_no_network_io_and_build_nothing():
    """Fresh interpreter: importing the three modules must not touch the
    network and must not construct the singletons."""
    proc = subprocess.run(
        [sys.executable, "-c", _IMPORT_PROBE],
        check=False,
        cwd=str(REPO_ROOT / "backend"),
        capture_output=True, text=True, timeout=120,
    )
    assert proc.returncode == 0, (
        f"import performed network I/O or built a singleton:\n"
        f"{proc.stderr[-800:]}"
    )


def test_cache_proxy_builds_on_first_use():
    """The lazy proxy still exposes the full SimulationCache API."""
    from app.core.cache import simulation_cache
    assert type(simulation_cache).__name__ == "_LazySimulationCache"
    # First attribute use builds the real cache (in-memory fallback here).
    assert simulation_cache.backend_type in ("redis", "in_memory")
    simulation_cache.set_simulation_result("probe", {"q": 1}, {"v": 1},
                                           ttl_seconds=60)
    assert simulation_cache.get_simulation_result("probe", {"q": 1}) == {"v": 1}
    assert simulation_cache.get_simulation_result("probe", {"q": 2}) is None
    simulation_cache.clear()


def test_m8_provider_proxy_builds_on_first_use():
    """The lazy provider proxy forwards to a real LLMProvider once touched."""
    from app.modules.m8_coach import service as coach_service
    from app.modules.m8_coach.llm_provider import LLMProvider
    provider = coach_service.llm_provider
    assert type(provider).__name__ == "_LazyLLMProvider"
    assert isinstance(provider._real(), LLMProvider)
