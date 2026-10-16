# Database migrations (Alembic)

Local development and tests still create tables at boot (`init_db`).
Production deploys run migrations instead:

    DATABASE_URL=postgresql+asyncpg://... alembic upgrade head

Create a new migration after changing models:

    alembic revision --autogenerate -m "describe the change"

The migration environment reads the same Settings as the app and swaps
the async driver for its sync counterpart (aiosqlite -> sqlite,
asyncpg -> psycopg), so `alembic` always targets the app's database.
