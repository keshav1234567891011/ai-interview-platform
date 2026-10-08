from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScheduledInterview(Base):
    __tablename__ = "scheduled_interviews"
    __table_args__ = (
        CheckConstraint("status IN ('scheduled','cancelled','started')", name="status"),
        CheckConstraint("question_count BETWEEN 1 AND 10", name="question_count"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(80))
    difficulty: Mapped[str] = mapped_column(String(20))
    focus_areas: Mapped[list[str]] = mapped_column(JSON)
    question_count: Mapped[int] = mapped_column(Integer)
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    interview_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("interviews.id", ondelete="SET NULL"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
