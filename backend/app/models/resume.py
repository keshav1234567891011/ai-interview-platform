from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.profile import Skill


class ResumeSkill(Base):
    __tablename__ = "resume_skills"
    resume_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("resumes.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[str] = mapped_column(String(40), ForeignKey("skills.id"), primary_key=True)


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    original_filename: Mapped[str] = mapped_column(String(180))
    storage_key: Mapped[str] = mapped_column(String(50), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    extracted_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    skills: Mapped[list[Skill]] = relationship(secondary="resume_skills", lazy="selectin")


class JobSkill(Base):
    __tablename__ = "job_skills"
    job_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("job_analyses.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[str] = mapped_column(String(40), ForeignKey("skills.id"), primary_key=True)
    requirement: Mapped[str] = mapped_column(String(20))


class JobAnalysis(Base):
    __tablename__ = "job_analyses"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    description: Mapped[str] = mapped_column(Text)
    role_keywords: Mapped[list[str]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
