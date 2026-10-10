"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels = None
depends_on = None


def _ts():
    return (
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("firebase_uid", sa.String(128), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("age", sa.Integer),
        sa.Column("sex", sa.String(16)),
        sa.Column("height_cm", sa.Float),
        sa.Column("weight_kg", sa.Float),
        sa.Column("diabetes_type", sa.String(32)),
        sa.Column("timezone", sa.String(64)),
        sa.Column("usual_meal_times", JSONB),
        sa.Column("preferred_language", sa.String(8), server_default="en", nullable=False),
        sa.Column("consent_accepted_at", sa.DateTime(timezone=True)),
        *_ts(),
    )
    op.create_index("ix_users_firebase_uid", "users", ["firebase_uid"], unique=True)

    op.create_table(
        "medications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("dose", sa.String(64)),
        sa.Column("schedule", sa.String(128)),
        sa.Column("notes", sa.String(512)),
        *_ts(),
    )

    op.create_table(
        "meals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("image_url", sa.String(512)),
        sa.Column("eaten_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("meal_type", sa.String(32)),
        sa.Column("total_carbs_g", sa.Float, server_default="0"),
        sa.Column("total_kcal", sa.Float, server_default="0"),
        sa.Column("confidence", sa.Float, server_default="0"),
        sa.Column("user_edited", sa.Boolean, server_default=sa.false()),
        sa.Column("note", sa.String(512)),
        *_ts(),
    )

    op.create_table(
        "detected_foods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("meal_id", UUID(as_uuid=True), sa.ForeignKey("meals.id", ondelete="CASCADE"), index=True),
        sa.Column("name_en", sa.String(128), nullable=False),
        sa.Column("name_ur", sa.String(128)),
        sa.Column("portion_g", sa.Float, server_default="0"),
        sa.Column("carbs_g", sa.Float, server_default="0"),
        sa.Column("kcal", sa.Float, server_default="0"),
        sa.Column("confidence", sa.Float, server_default="0"),
        *_ts(),
    )

    op.create_table(
        "predictions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("meal_id", UUID(as_uuid=True), sa.ForeignKey("meals.id", ondelete="CASCADE"), index=True),
        sa.Column("curve", JSONB, nullable=False),
        sa.Column("peak_mgdl", sa.Float, nullable=False),
        sa.Column("peak_at_min", sa.Float, nullable=False),
        sa.Column("time_above_range_min", sa.Float, server_default="0"),
        *_ts(),
    )

    op.create_table(
        "simulations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("meal_id", UUID(as_uuid=True), sa.ForeignKey("meals.id", ondelete="CASCADE"), index=True),
        sa.Column("inputs", JSONB, nullable=False),
        sa.Column("baseline_curve", JSONB, nullable=False),
        sa.Column("simulated_curve", JSONB, nullable=False),
        sa.Column("delta_peak_mgdl", sa.Float, nullable=False),
        sa.Column("delta_tar_min", sa.Float, nullable=False),
        *_ts(),
    )

    op.create_table(
        "insights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("window", sa.String(16), nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        *_ts(),
    )

    op.create_table(
        "coach_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("language", sa.String(8), server_default="en"),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("safety_category", sa.String(32)),
        sa.Column("refs", JSONB),
        sa.Column("mini_chart", JSONB),
        sa.Column("follow_ups", JSONB),
        *_ts(),
    )


def downgrade() -> None:
    for t in (
        "coach_messages",
        "insights",
        "simulations",
        "predictions",
        "detected_foods",
        "meals",
        "medications",
        "users",
    ):
        op.drop_table(t)
