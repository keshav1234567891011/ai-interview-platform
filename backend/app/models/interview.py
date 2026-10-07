from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Interview(Base):
    __tablename__ = "interviews"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created','in_progress','completed','abandoned')", name="status"
        ),
        CheckConstraint("question_count BETWEEN 1 AND 10", name="question_count"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(80))
    difficulty: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="created")
    question_count: Mapped[int] = mapped_column(Integer)
    focus_areas: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    questions: Mapped[list["InterviewQuestion"]] = relationship(
        back_populates="interview",
        cascade="all, delete-orphan",
        order_by="InterviewQuestion.sequence",
        lazy="selectin",
    )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    __table_args__ = (
        UniqueConstraint("interview_id", "sequence"),
        CheckConstraint("sequence > 0", name="sequence"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    interview_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("interviews.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int] = mapped_column(Integer)
    question_text: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40))
    difficulty: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(20), default="question_bank")
    interview: Mapped[Interview] = relationship(back_populates="questions")
    answer: Mapped["InterviewAnswer | None"] = relationship(
        cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    question_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("interview_questions.id", ondelete="CASCADE"), primary_key=True
    )
    answer_text: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
