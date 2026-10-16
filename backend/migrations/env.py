"""Alembic environment for GlycoTwin (WS4).

The app speaks async SQLAlchemy; Alembic runs sync. The URL is derived
from the same Settings the app uses, with the async driver swapped for
its sync counterpart, so migrations always target the app's database.
"""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.core.config import get_settings  # noqa: E402
from app.core.db import Base  # noqa: E402
from app.modules.m4_auth import models as _auth_models  # noqa: E402,F401
from app.modules.m1_ingestion import db_models as _m1_models  # noqa: E402,F401


def _sync_url() -> str:
    url = get_settings().database_url
    return (url.replace("sqlite+aiosqlite", "sqlite")
               .replace("postgresql+asyncpg", "postgresql+psycopg"))


config.set_main_option("sqlalchemy.url", _sync_url())
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=_sync_url(), target_metadata=target_metadata,
                      literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
