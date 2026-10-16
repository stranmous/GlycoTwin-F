"""LI-3: encrypt health columns at rest.

Changes the storage type of health-value columns to TEXT, the wire format of
the Fernet TypeDecorators in app/core/crypto.py (EncryptedFloat /
EncryptedString / EncryptedInteger / EncryptedJSON). Encryption itself happens
in the ORM layer — the database only ever sees ciphertext.

Scope: glucose_readings.glucose_mg_dl; meal_logs dish_label + macros;
calibration_snapshots numeric parameters; metabolic_profiles health fields.
Ids, user_ids, timestamps, sources, email (login lookup) and password_hash
stay plaintext by design — see app/core/crypto.py for the rationale.

Data note: rows written BEFORE this migration hold plaintext values and will
fail to decrypt afterwards. There is no production data yet (LI-3 ships with
the feature), so no backfill is attempted — migrations must not depend on
app secrets. Wipe and recreate any dev database after upgrading.

Revision ID: 9e4b2c7d1a5f
Revises: 7c2a9e4b1f3d
Create Date: 2026-10-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '9e4b2c7d1a5f'
down_revision: str | None = '7c2a9e4b1f3d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, column, old type) — new type is always sa.Text()
ENCRYPTED_COLUMNS: list[tuple[str, str, sa.types.TypeEngine]] = [
    ("glucose_readings", "glucose_mg_dl", sa.Float()),
    ("meal_logs", "dish_label", sa.String(length=255)),
    ("meal_logs", "carbs_g", sa.Float()),
    ("meal_logs", "protein_g", sa.Float()),
    ("meal_logs", "fat_g", sa.Float()),
    ("meal_logs", "fiber_g", sa.Float()),
    ("calibration_snapshots", "baseline_glucose_mg_dl", sa.Float()),
    ("calibration_snapshots", "estimated_insulin_sensitivity", sa.Float()),
    ("calibration_snapshots", "carb_absorption_rate_index", sa.Float()),
    ("calibration_snapshots", "confidence_score", sa.Float()),
    ("metabolic_profiles", "age", sa.Integer()),
    ("metabolic_profiles", "weight_kg", sa.Float()),
    ("metabolic_profiles", "height_cm", sa.Float()),
    ("metabolic_profiles", "diabetes_type", sa.String(length=50)),
    ("metabolic_profiles", "activity_level", sa.String(length=50)),
    ("metabolic_profiles", "medications", sa.JSON()),
    ("metabolic_profiles", "hba1c", sa.Float()),
]


def _alter(table: str, column: str,
           from_type: sa.types.TypeEngine, to_type: sa.types.TypeEngine,
           using: str | None = None) -> None:
    # batch_alter_table keeps this working on SQLite (which cannot ALTER
    # COLUMN directly); on Postgres the USING clause casts existing values.
    kwargs: dict = {}
    if using:
        kwargs["postgresql_using"] = using
    with op.batch_alter_table(table) as batch_op:
        batch_op.alter_column(
            column,
            existing_type=from_type,
            type_=to_type,
            **kwargs,
        )


def _using_for(old_type: sa.types.TypeEngine, column: str) -> str:
    if isinstance(old_type, sa.Float):
        return f"{column}::double precision"
    if isinstance(old_type, sa.Integer):
        return f"{column}::integer"
    if isinstance(old_type, sa.JSON):
        return f"{column}::json"
    return f"{column}::varchar"


def upgrade() -> None:
    for table, column, old_type in ENCRYPTED_COLUMNS:
        _alter(table, column, old_type, sa.Text(),
               using=f"{column}::text")


def downgrade() -> None:
    for table, column, old_type in ENCRYPTED_COLUMNS:
        _alter(table, column, sa.Text(), old_type,
               using=_using_for(old_type, column))
