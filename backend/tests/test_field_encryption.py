"""LI-3: field-level at-rest encryption.

- Round-trip: health values written through the API come back identical.
- Fail-closed: production boot without a valid Fernet key raises; decrypting
  with the wrong key raises InvalidToken.
- Plaintext columns (user_id, timestamps) still support queries.
- The raw SQLite file contains no plaintext health values.
"""
import os
import sqlite3
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

# Fixed test key, set before the app modules are imported.
TEST_KEY = Fernet.generate_key().decode("utf-8")
os.environ.setdefault("DB_ENCRYPTION_KEY", TEST_KEY)

import pytest
from sqlalchemy import create_engine, select

import app.modules.m1_ingestion.db_models as _m1_models
import app.modules.m4_auth.models as _m4_models

# Side-effect imports: register all ORM models with Base.metadata so
# create_all() creates every table. Referenced to satisfy linters.
assert _m1_models and _m4_models
from app.core.config import Settings, get_settings
from app.core.crypto import (
    EncryptedFloat,
    EncryptedJSON,
    EncryptedString,
    get_fernet,
    is_valid_fernet_key,
)
from app.core.db import Base
from app.modules.m1_ingestion.db_models import GlucoseReading

get_settings.cache_clear()


@pytest.fixture()
def file_db(tmp_path):
    """File-backed SQLite DB with all tables; yields (db_path, engine)."""
    db_path = tmp_path / "enc_test.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    yield db_path, engine
    engine.dispose()


def test_fuzz_round_trip_types():
    assert EncryptedFloat().process_result_value(
        EncryptedFloat().process_bind_param(142.5, None), None) == 142.5
    assert EncryptedString().process_result_value(
        EncryptedString().process_bind_param("nihari", None), None) == "nihari"
    assert EncryptedJSON().process_result_value(
        EncryptedJSON().process_bind_param(["metformin"], None), None) == ["metformin"]
    assert EncryptedFloat().process_bind_param(None, None) is None
    assert EncryptedString().process_result_value(None, None) is None


def test_ciphertext_is_not_plaintext():
    token = EncryptedFloat().process_bind_param(142.5, None)
    assert "142.5" not in token
    # Fernet tokens are randomized: same value -> different token
    assert token != EncryptedFloat().process_bind_param(142.5, None)


def test_wrong_key_cannot_decrypt():
    token = EncryptedFloat().process_bind_param(99.9, None)
    other = Fernet(Fernet.generate_key())
    with pytest.raises(InvalidToken):
        other.decrypt(token.encode("utf-8"))


def test_production_fails_closed_without_valid_key():
    with pytest.raises(RuntimeError, match="DB_ENCRYPTION_KEY"):
        Settings(environment="production", jwt_secret="x" * 40,
                 db_encryption_key="").validate_runtime()
    with pytest.raises(RuntimeError, match="DB_ENCRYPTION_KEY"):
        Settings(environment="production", jwt_secret="x" * 40,
                 db_encryption_key="too-short").validate_runtime()
    # A real key boots.
    key = Fernet.generate_key().decode()
    Settings(environment="production", jwt_secret="x" * 40,
             db_encryption_key=key).validate_runtime()


def test_is_valid_fernet_key():
    assert is_valid_fernet_key(Fernet.generate_key().decode())
    assert not is_valid_fernet_key("")
    assert not is_valid_fernet_key("not-a-key")


def test_orm_round_trip_and_plaintext_query(file_db):
    from sqlalchemy.orm import Session
    _, engine = file_db
    uid = "user-123"
    with Session(engine) as s:
        s.add(GlucoseReading(user_id=uid, glucose_mg_dl=173.25,
                             recorded_at=datetime.now(UTC)))
        s.add(GlucoseReading(user_id="other", glucose_mg_dl=90.0,
                             recorded_at=datetime.now(UTC)))
        s.commit()
    with Session(engine) as s:
        # plaintext user_id still supports queries
        rows = s.scalars(select(GlucoseReading)
                         .where(GlucoseReading.user_id == uid)).all()
        assert len(rows) == 1
        assert rows[0].glucose_mg_dl == 173.25


def test_raw_db_file_has_no_plaintext_values(file_db):
    from sqlalchemy.orm import Session
    db_path, engine = file_db
    with Session(engine) as s:
        s.add(GlucoseReading(user_id="u1", glucose_mg_dl=173.25,
                             recorded_at=datetime.now(UTC)))
        s.commit()
    engine.dispose()
    raw = db_path.read_bytes()
    assert b"173.25" not in raw
    # sanity: the row is really there (as ciphertext)
    con = sqlite3.connect(db_path)
    stored = con.execute("SELECT glucose_mg_dl FROM glucose_readings").fetchone()[0]
    con.close()
    assert isinstance(stored, str) and "173.25" not in stored
    assert get_fernet().decrypt(stored.encode()).decode() == repr(173.25)


def test_api_round_trip_encrypted(authed_client):
    client, headers = authed_client
    ts = datetime.now(UTC).isoformat()
    r = client.post("/api/v1/ingestion/cgm", headers=headers, json=[
        {"timestamp": ts, "glucose_mg_dl": 167.5}])
    assert r.status_code == 200, r.text
    r = client.get("/api/v1/ingestion/history/readings", headers=headers)
    assert r.status_code == 200
    values = [x["glucose_mg_dl"] for x in r.json()["readings"]]
    assert 167.5 in values


def test_gen_key_script_produces_valid_key():
    # Repo root (backend/tests/ -> backend/ -> repo) — portable across machines.
    repo_root = str(Path(__file__).resolve().parents[2])
    result = subprocess.run(
        [sys.executable, "scripts/gen_key.py"],
        cwd=repo_root,
        capture_output=True, text=True, timeout=30, check=False)
    assert result.returncode == 0
    assert is_valid_fernet_key(result.stdout.strip())
