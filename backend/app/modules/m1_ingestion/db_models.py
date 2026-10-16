"""M1 persistence tables — the "twin over time".

The FYP was stateless: predictions, meals and CGM readings evaporated after
each request, so there was no longitudinal record to calibrate against or to
show in a dashboard. These three tables give the twin a memory:

- glucose_readings: the user's CGM/finger-stick history
- meal_logs: meals the user logged (manual or via M5)
- calibration_snapshots: the M2 parameters that were active at a point in
  time, so any past prediction can be reproduced and audited
"""
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.crypto import EncryptedFloat, EncryptedString
from app.core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class GlucoseReading(Base):
    __tablename__ = "glucose_readings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # LI-3: health values encrypted at rest; ids/timestamps stay plaintext
    # for ownership checks and range queries.
    glucose_mg_dl: Mapped[float] = mapped_column(EncryptedFloat)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(20), default="cgm")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class MealLog(Base):
    __tablename__ = "meal_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    dish_label: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    carbs_g: Mapped[float] = mapped_column(EncryptedFloat, default=0.0)
    protein_g: Mapped[float] = mapped_column(EncryptedFloat, default=0.0)
    fat_g: Mapped[float] = mapped_column(EncryptedFloat, default=0.0)
    fiber_g: Mapped[float] = mapped_column(EncryptedFloat, default=0.0)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(20), default="manual")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class CalibrationSnapshot(Base):
    __tablename__ = "calibration_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # phenotype_cluster_id stays plaintext: coarse non-identifying label.
    phenotype_cluster_id: Mapped[str] = mapped_column(String(64))
    baseline_glucose_mg_dl: Mapped[float] = mapped_column(EncryptedFloat)
    estimated_insulin_sensitivity: Mapped[float] = mapped_column(EncryptedFloat)
    carb_absorption_rate_index: Mapped[float] = mapped_column(EncryptedFloat)
    confidence_score: Mapped[float] = mapped_column(EncryptedFloat)
    is_cold_start: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
