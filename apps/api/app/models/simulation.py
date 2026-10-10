import uuid
from sqlalchemy import Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models._mixins import IdMixin, TimestampsMixin


class Simulation(Base, IdMixin, TimestampsMixin):
    __tablename__ = "simulations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    meal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meals.id", ondelete="CASCADE"), index=True
    )
    inputs: Mapped[dict] = mapped_column(JSONB)  # portion_scale, walk_minutes, intensity, timing
    baseline_curve: Mapped[list[dict]] = mapped_column(JSONB)
    simulated_curve: Mapped[list[dict]] = mapped_column(JSONB)
    delta_peak_mgdl: Mapped[float] = mapped_column(Float)
    delta_tar_min: Mapped[float] = mapped_column(Float)
