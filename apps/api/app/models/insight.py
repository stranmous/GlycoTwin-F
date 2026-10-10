import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models._mixins import IdMixin, TimestampsMixin


class Insight(Base, IdMixin, TimestampsMixin):
    __tablename__ = "insights"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(64))  # e.g. "tir", "spike_meal", "pattern"
    window: Mapped[str] = mapped_column(String(16))  # "today" | "7d" | "30d"
    payload: Mapped[dict] = mapped_column(JSONB)
