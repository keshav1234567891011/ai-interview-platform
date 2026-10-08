from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, Integer, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.administration import AdminPermission


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role != 'owner' OR is_active", name="owner_active"),
        Index(
            "uq_users_single_owner",
            "role",
            unique=True,
            postgresql_where=text("role = 'owner'"),
            sqlite_where=text("role = 'owner'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    hashed_password: Mapped[str] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(
        String(10),
        CheckConstraint("role IN ('user','admin','owner')", name="role"),
        default="user",
        server_default="user",
    )
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    password_change_required: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    permission_records: Mapped[list["AdminPermission"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def permissions(self) -> list[str]:
        from app.core.permissions import PERMISSIONS

        return sorted(
            PERMISSIONS
            if self.role == "owner"
            else (record.permission for record in self.permission_records if self.role == "admin")
        )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
