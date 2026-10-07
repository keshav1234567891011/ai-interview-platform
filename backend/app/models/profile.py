from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[str] = mapped_column(String(20))


class ProfileSkill(Base):
    __tablename__ = "profile_skills"
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("user_profiles.user_id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[str] = mapped_column(String(40), ForeignKey("skills.id"), primary_key=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    target_role: Mapped[str] = mapped_column(String(80), default="")
    experience_level: Mapped[str] = mapped_column(String(24), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    skills: Mapped[list[Skill]] = relationship(secondary="profile_skills", lazy="selectin")
