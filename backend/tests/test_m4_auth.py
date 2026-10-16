"""M4 tests — registration, JWT login, metabolic profile (report M4 FE-1/FE-2).

Runs against an in-memory SQLite database via a get_db override, so the
harness proves the real SQLAlchemy models and PBKDF2/JWT code paths offline.
"""
import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.modules.m4_auth.models
from app.core.db import Base, get_db
from app.main import app

EMAIL = "arsalan.test@example.com"
PASSWORD = "correct horse battery"


@pytest.fixture(scope="module")
def auth_client(client):
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


def _register(client, email: str = EMAIL, **extra):
    return client.post("/api/v1/auth/register",
                       json={"email": email, "password": PASSWORD, **extra})


def test_register_login_profile_flow(auth_client):
    r = _register(auth_client, active_language="ur")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["email"] == EMAIL
    assert body["user"]["active_language"] == "ur"
    token = body["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # profile starts unset
    assert auth_client.get("/api/v1/auth/profile", headers=headers).status_code == 404

    r = auth_client.put("/api/v1/auth/profile", headers=headers, json={
        "age": 23, "weight_kg": 70, "height_cm": 175,
        "diabetes_type": "type1", "activity_level": "moderate",
        "medications": [], "hba1c": 6.4,
    })
    assert r.status_code == 200, r.text
    assert r.json()["bmi"] == 22.9  # 70 kg / 1.75 m

    r = auth_client.get("/api/v1/auth/profile", headers=headers)
    assert r.status_code == 200
    assert r.json()["diabetes_type"] == "type1"

    # login issues a fresh working token
    r = auth_client.post("/api/v1/auth/login",
                         json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    r = auth_client.get("/api/v1/auth/me",
                        headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL


def test_duplicate_email_conflict(auth_client):
    assert _register(auth_client, "dupe@example.com").status_code == 201
    assert _register(auth_client, "dupe@example.com").status_code == 409


def test_wrong_password_rejected(auth_client):
    assert _register(auth_client, "second@example.com").status_code == 201
    r = auth_client.post("/api/v1/auth/login",
                         json={"email": "second@example.com", "password": "wrong-password"})
    assert r.status_code == 401
    # unknown user gets the same indistinguishable 401
    r = auth_client.post("/api/v1/auth/login",
                         json={"email": "ghost@example.com", "password": "whatever123"})
    assert r.status_code == 401


def test_protected_routes_require_token(auth_client):
    assert auth_client.get("/api/v1/auth/me").status_code == 401
    assert auth_client.get("/api/v1/auth/profile").status_code == 401
    assert auth_client.put("/api/v1/auth/profile", json={}).status_code == 401


def test_registration_validation(auth_client):
    # unsupported language (report mandates en/ur) and short password
    r = _register(auth_client, "third@example.com", active_language="fr")
    assert r.status_code == 422
    r = auth_client.post("/api/v1/auth/register",
                         json={"email": "x@example.com", "password": "short"})
    assert r.status_code == 422
    r = auth_client.post("/api/v1/auth/register",
                         json={"email": "not-an-email", "password": PASSWORD})
    assert r.status_code == 422


def test_account_deletion_erases_user_and_profile(client):
    reg = client.post("/api/v1/auth/register",
                      json={"email": "delete-me@example.com", "password": "long-enough-pw",
                            "display_name": "Delete Me"})
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    prof = client.put("/api/v1/auth/profile", headers=headers, json={
        "age": 24, "weight_kg": 70, "height_cm": 175, "diabetes_type": "none",
        "activity_level": "moderate"})
    assert prof.status_code == 200, prof.text

    deleted = client.request("DELETE", "/api/v1/auth/me", headers=headers)
    assert deleted.status_code == 200 and deleted.json()["status"] == "deleted"

    # The old token no longer resolves to a user, and the account cannot log in.
    assert client.get("/api/v1/auth/me", headers=headers).status_code in (401, 404)
    assert client.get("/api/v1/auth/profile", headers=headers).status_code in (401, 404)
    login = client.post("/api/v1/auth/login",
                        json={"email": "delete-me@example.com", "password": "long-enough-pw"})
    assert login.status_code == 401


def test_partial_profile_update_and_defaults(auth_client):
    reg = _register(auth_client, "partial@example.com")
    assert reg.status_code == 201
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Partial update on cold start creates profile with defaults
    r = auth_client.put("/api/v1/auth/profile", headers=headers, json={
        "activity_level": "moderate",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["activity_level"] == "moderate"
    assert data["age"] == 35
    assert data["weight_kg"] == 70.0
    assert data["height_cm"] == 170.0
    assert data["bmi"] == 24.2

    # Partial update with structured medications and display name / language
    r2 = auth_client.put("/api/v1/auth/profile", headers=headers, json={
        "display_name": "Fatima Zahra",
        "preferred_language": "ur",
        "medications": [{"name": "Metformin", "dose": "500mg"}],
    })
    assert r2.status_code == 200, r2.text
    data2 = r2.json()
    assert len(data2["medications"]) == 1
    assert data2["medications"][0]["name"] == "Metformin"
    assert data2["age"] == 35  # Preserved

    # Verify user active_language was updated
    me = auth_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["active_language"] == "ur"

