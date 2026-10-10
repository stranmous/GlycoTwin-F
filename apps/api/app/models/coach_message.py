import uuid
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models._mixins import IdMixin, TimestampsMixin


class CoachMessage(Base, IdMixin, TimestampsMixin):
    __tablename__ = "coach_messages"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # "user" | "assistant"
    language: Mapped[str] = mapped_column(String(8), default="en")
    text: Mapped[str] = mapped_column(Text)
    safety_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    refs: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    mini_chart: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    follow_ups: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
