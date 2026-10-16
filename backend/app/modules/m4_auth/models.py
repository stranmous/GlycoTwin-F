"""M4 tables — ported from the report's schema (Section: Metabolic Profiles).

Deviations from the report DDL, both deliberate and documented in DESIGN.md:
- auth is local JWT (D4), so `firebase_uid` is replaced by a local password
  hash; the report's Firebase claim is not implemented anywhere.
- `medications TEXT[]` becomes portable JSON (SQLite/Postgres both fine).
"""
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.crypto import (
    EncryptedFloat,
    EncryptedInteger,
    EncryptedJSON,
    EncryptedString,
)
from app.core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    active_language: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    profile: Mapped["MetabolicProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class MetabolicProfile(Base):
    __tablename__ = "metabolic_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    # LI-3: health/profile values encrypted at rest. email stays plaintext
    # (login lookup needs equality); password_hash is already a salted hash.
    age: Mapped[int] = mapped_column(EncryptedInteger)
    weight_kg: Mapped[float] = mapped_column(EncryptedFloat)
    height_cm: Mapped[float] = mapped_column(EncryptedFloat)
    diabetes_type: Mapped[str] = mapped_column(EncryptedString)
    activity_level: Mapped[str] = mapped_column(EncryptedString)
    medications: Mapped[list] = mapped_column(EncryptedJSON, default=list)
    hba1c: Mapped[float | None] = mapped_column(EncryptedFloat, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user: Mapped[User] = relationship(back_populates="profile")
