from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AISettings(Base):
    __tablename__ = "ai_settings"
    __table_args__ = (CheckConstraint("id = 1", name="singleton"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    text_model: Mapped[str] = mapped_column(String(60), default="gpt-5-mini")
    transcription_model: Mapped[str] = mapped_column(String(60), default="gpt-4o-mini-transcribe")
    encrypted_api_key: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
