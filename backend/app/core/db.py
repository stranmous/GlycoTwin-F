"""Async database setup (mirrors GlycoTwin-AI-Core's database.py conventions,
with the URL now coming from Settings instead of a module-level constant)."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import get_settings

Base = declarative_base()

_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, echo=False)
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _session_factory


async def get_db():
    async with get_session_factory()() as session:
        yield session


async def init_db() -> None:
    """Create tables for local/dev runs. Production uses Alembic migrations."""
    # Import models so they register on Base.metadata before create_all.
    from app.modules.m1_ingestion import db_models as _m1_models  # noqa: F401
    from app.modules.m4_auth import models as _auth_models  # noqa: F401

    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
