"""m1 persistence: glucose_readings, meal_logs, calibration_snapshots

Revision ID: 7c2a9e4b1f3d
Revises: 1d41deffc29f
Create Date: 2026-10-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '7c2a9e4b1f3d'
down_revision: str | None = '1d41deffc29f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'glucose_readings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('glucose_mg_dl', sa.Float(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_glucose_readings_user_id', 'glucose_readings', ['user_id'])
    op.create_table(
        'meal_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('dish_label', sa.String(length=255), nullable=True),
        sa.Column('carbs_g', sa.Float(), nullable=False),
        sa.Column('protein_g', sa.Float(), nullable=False),
        sa.Column('fat_g', sa.Float(), nullable=False),
        sa.Column('fiber_g', sa.Float(), nullable=False),
        sa.Column('logged_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_meal_logs_user_id', 'meal_logs', ['user_id'])
    op.create_table(
        'calibration_snapshots',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('phenotype_cluster_id', sa.String(length=64), nullable=False),
        sa.Column('baseline_glucose_mg_dl', sa.Float(), nullable=False),
        sa.Column('estimated_insulin_sensitivity', sa.Float(), nullable=False),
        sa.Column('carb_absorption_rate_index', sa.Float(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('is_cold_start', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_calibration_snapshots_user_id', 'calibration_snapshots', ['user_id']
    )


def downgrade() -> None:
    op.drop_index('ix_calibration_snapshots_user_id', table_name='calibration_snapshots')
    op.drop_table('calibration_snapshots')
    op.drop_index('ix_meal_logs_user_id', table_name='meal_logs')
    op.drop_table('meal_logs')
    op.drop_index('ix_glucose_readings_user_id', table_name='glucose_readings')
    op.drop_table('glucose_readings')
