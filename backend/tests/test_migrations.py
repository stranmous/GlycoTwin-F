"""WS4: Alembic migrations must apply cleanly to an empty database.

Runs the real CLI in a subprocess against a temp SQLite file, the same
way a production deploy runs `alembic upgrade head` before booting.
"""
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def _alembic(db_path: Path, *args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "DATABASE_URL": f"sqlite+aiosqlite:///{db_path}"}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=120, check=False,
    )


def test_upgrade_head_creates_tables(tmp_path):
    db = tmp_path / "mig.db"
    result = _alembic(db, "upgrade", "head")
    assert result.returncode == 0, result.stderr[-2000:]
    tables = {r[0] for r in sqlite3.connect(db).execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"users", "metabolic_profiles", "alembic_version"} <= tables


def test_downgrade_base_removes_tables(tmp_path):
    db = tmp_path / "mig.db"
    assert _alembic(db, "upgrade", "head").returncode == 0
    result = _alembic(db, "downgrade", "base")
    assert result.returncode == 0, result.stderr[-2000:]
    tables = {r[0] for r in sqlite3.connect(db).execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert "users" not in tables
