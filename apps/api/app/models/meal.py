from datetime import datetime
import uuid
from sqlalchemy import String, Float, DateTime, ForeignKey, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models._mixins import IdMixin, TimestampsMixin


class Meal(Base, IdMixin, TimestampsMixin):
    __tablename__ = "meals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    eaten_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    meal_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # breakfast/lunch/...
    total_carbs_g: Mapped[float] = mapped_column(Float, default=0.0)
    total_kcal: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    user_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(String(512), nullable=True)

    detected_foods: Mapped[list["DetectedFood"]] = relationship(
        back_populates="meal", cascade="all, delete-orphan"
    )


class DetectedFood(Base, IdMixin, TimestampsMixin):
    __tablename__ = "detected_foods"

    meal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meals.id", ondelete="CASCADE"), index=True
    )
    name_en: Mapped[str] = mapped_column(String(128))
    name_ur: Mapped[str | None] = mapped_column(String(128), nullable=True)
    portion_g: Mapped[float] = mapped_column(Float, default=0.0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0.0)
    kcal: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    meal: Mapped[Meal] = relationship(back_populates="detected_foods")
