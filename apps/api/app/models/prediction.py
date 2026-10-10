import uuid
from sqlalchemy import Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models._mixins import IdMixin, TimestampsMixin


class Prediction(Base, IdMixin, TimestampsMixin):
    __tablename__ = "predictions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    meal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meals.id", ondelete="CASCADE"), index=True
    )
    # [{ "tMin": 0, "mgdl": 110 }, ...]
    curve: Mapped[list[dict]] = mapped_column(JSONB)
    peak_mgdl: Mapped[float] = mapped_column(Float)
    peak_at_min: Mapped[float] = mapped_column(Float)
    time_above_range_min: Mapped[float] = mapped_column(Float, default=0.0)
