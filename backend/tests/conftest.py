import os

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["FASTSAM_MODEL_PATH"] = "weights/fixture_mode.pt"

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.modules.m1_ingestion.db_models
import app.modules.m4_auth.models
from app.core.config import get_settings
from app.core.db import Base, get_db
from app.main import app


def pytest_configure(config: pytest.Config) -> None:
    """Ensure test environment isolation at pytest configuration time."""
    os.environ["FASTSAM_MODEL_PATH"] = "weights/fixture_mode.pt"
    get_settings.cache_clear()


@pytest.fixture(autouse=True, scope="session")
def isolate_vision_weights_session() -> None:
    """Session-level isolation ensuring outer shell overrides cannot break fixture mode."""
    os.environ["FASTSAM_MODEL_PATH"] = "weights/fixture_mode.pt"
    get_settings.cache_clear()
    yield
    os.environ["FASTSAM_MODEL_PATH"] = "weights/fixture_mode.pt"
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def isolate_vision_weights_function() -> None:
    """Per-test isolation ensuring fixture mode remains active across all tests."""
    os.environ["FASTSAM_MODEL_PATH"] = "weights/fixture_mode.pt"
    get_settings.cache_clear()
    yield
    os.environ["FASTSAM_MODEL_PATH"] = "weights/fixture_mode.pt"
    get_settings.cache_clear()


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def authed_client(client):
    """client + Authorization headers for a registered user, against an
    in-memory SQLite DB (get_db override). For routes that now require auth."""
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
    try:
        r = client.post("/api/v1/auth/register",
                        json={"email": "phase_d@test.example",
                              "password": "test-password-123"})
        assert r.status_code == 201, r.text
        token = r.json()["access_token"]
        yield client, {"Authorization": f"Bearer {token}"}
    finally:
        app.dependency_overrides.pop(get_db, None)
