from typing import Literal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.administration import AdminPermission, AuditEvent
from app.models.user import User

AuditAction = Literal[
    "owner_bootstrapped",
    "admin_created",
    "admin_promoted",
    "admin_permissions_changed",
    "admin_password_reset",
    "admin_disabled",
    "admin_enabled",
    "admin_revoked",
    "owner_password_changed",
    "admin_password_changed",
    "user_password_changed",
    "user_updated",
]


def audit(db: Session, actor: User, target: User, action: AuditAction, *, permissions=None):
    db.add(
        AuditEvent(
            actor_id=actor.id,
            target_id=target.id,
            action=action,
            details={"permissions": sorted(permissions)} if permissions is not None else {},
        )
    )


def lock_user(db: Session, id) -> User:
    user = db.scalar(
        select(User)
        .where(User.id == id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise HTTPException(404, "Account not found")
    return user


def lock_owner(db: Session, owner: User, version: int) -> User:
    locked = lock_user(db, owner.id)
    if (
        locked.role != "owner"
        or not locked.is_active
        or locked.password_change_required
        or locked.token_version != version
    ):
        raise HTTPException(403, "Owner session is no longer authorized")
    return locked


def assign_permissions(user: User, permissions: list[str]):
    user.permission_records = [
        AdminPermission(permission=value) for value in sorted(set(permissions))
    ]
