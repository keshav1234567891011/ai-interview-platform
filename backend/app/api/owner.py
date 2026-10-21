from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentOwner, DbSession
from app.core.config import get_settings
from app.core.permissions import PERMISSIONS
from app.core.rate_limit import reserve
from app.core.security import password_hash
from app.models.administration import AuditEvent
from app.models.user import User
from app.schemas.ai_settings import (
    AISettingsResponse,
    AISettingsUpdate,
    APIKeyReplace,
    ConnectionResult,
)
from app.schemas.auth import UserResponse
from app.schemas.owner import AdminCreate, AdminState, PermissionUpdate, TemporaryPassword
from app.services.administration import assign_permissions, audit, lock_owner, lock_user
from app.services.ai_settings import cipher, editable, resolved
from app.services.provider_connection import test_connection

router = APIRouter(prefix="/api/owner", tags=["Owner control center"])


@router.get("/permissions")
def permissions(owner: CurrentOwner):
    return PERMISSIONS


@router.get("/admins", response_model=list[UserResponse])
def admins(owner: CurrentOwner, db: DbSession, offset: int = Query(0, ge=0, le=100000)):
    return db.scalars(
        select(User)
        .where(User.role == "admin")
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(50)
    ).all()


@router.get("/ai-settings", response_model=AISettingsResponse)
def ai_settings(owner: CurrentOwner, db: DbSession):
    return resolved(db)[1]


@router.put("/ai-settings", response_model=AISettingsResponse)
def update_ai_settings(payload: AISettingsUpdate, owner: CurrentOwner, db: DbSession):
    owner = mutation_owner(db, owner)
    previous = resolved(db)[1]
    record = editable(db, owner)
    if previous.enabled != payload.enabled:
        audit(
            db, owner, owner, "ai_provider_enabled" if payload.enabled else "ai_provider_disabled"
        )
    if (previous.text_model, previous.transcription_model) != (
        payload.text_model,
        payload.transcription_model,
    ):
        audit(db, owner, owner, "ai_models_changed")
    record.enabled = payload.enabled
    record.text_model = payload.text_model
    record.transcription_model = payload.transcription_model
    db.commit()
    return resolved(db)[1]


@router.put("/ai-settings/key", response_model=AISettingsResponse)
def replace_ai_key(payload: APIKeyReplace, owner: CurrentOwner, db: DbSession):
    encrypted = cipher().encrypt(payload.api_key.get_secret_value().encode()).decode("ascii")
    owner = mutation_owner(db, owner)
    record = editable(db, owner)
    action = "ai_key_replaced" if record.encrypted_api_key else "ai_key_added"
    record.encrypted_api_key = encrypted
    audit(db, owner, owner, action)
    db.commit()
    return resolved(db)[1]


@router.delete("/ai-settings/key", response_model=AISettingsResponse)
def remove_ai_key(owner: CurrentOwner, db: DbSession):
    cipher()  # Missing/invalid encryption configuration must fail closed for key mutations.
    owner = mutation_owner(db, owner)
    record = editable(db, owner)
    if record.encrypted_api_key:
        record.encrypted_api_key = None
        audit(db, owner, owner, "ai_key_removed")
    db.commit()
    return resolved(db)[1]


@router.post("/ai-settings/test", response_model=ConnectionResult)
def test_ai_connection(owner: CurrentOwner, db: DbSession):
    if get_settings().app_env != "test":
        reserve(db, "owner-ai-connection", str(owner.id), 3, 60)
    owner = mutation_owner(db, owner)
    settings, status = resolved(db)
    # Release the owner lock before bounded network I/O; no external request under a row lock.
    audit(db, owner, owner, "ai_connection_tested")
    db.commit()
    if not status.enabled:
        return ConnectionResult(status="disabled")
    if status.fallback_active:
        return ConnectionResult(status="not_configured")
    return ConnectionResult(status=test_connection(settings))


@router.get("/audit")
def audit_log(owner: CurrentOwner, db: DbSession, offset: int = Query(0, ge=0, le=100000)):
    return [
        {
            "id": row.id,
            "actor_id": row.actor_id,
            "target_id": row.target_id,
            "action": row.action,
            "details": row.details,
            "created_at": row.created_at,
        }
        for row in db.scalars(
            select(AuditEvent).order_by(AuditEvent.created_at.desc()).offset(offset).limit(50)
        ).all()
    ]


def mutation_owner(db, owner):
    version = owner.token_version
    if get_settings().app_env != "test":
        reserve(db, "owner-management", str(owner.id), 30, 600)
    return lock_owner(db, owner, version)


def admin_target(db, id):
    target = lock_user(db, id)
    if target.role != "admin":
        raise HTTPException(409, "This action applies only to delegated administrator accounts")
    return target


@router.post("/admins", response_model=UserResponse, status_code=201)
def create_admin(payload: AdminCreate, owner: CurrentOwner, db: DbSession):
    owner = mutation_owner(db, owner)
    existing = db.scalar(select(User).where(User.email == str(payload.email)))
    if payload.existing_user_id:
        target = lock_user(db, payload.existing_user_id)
        if target.role != "user" or target.email != str(payload.email) or not target.is_active:
            raise HTTPException(409, "Select the matching active candidate account for promotion")
    else:
        if existing is not None:
            raise HTTPException(
                409, "An account with this email exists. Use explicit candidate promotion."
            )
        target = User(email=str(payload.email), token_version=0, is_active=True)
        db.add(target)
    target.display_name = payload.display_name
    target.role = "admin"
    target.hashed_password = password_hash.hash(payload.password.get_secret_value())
    target.password_change_required = True
    target.token_version += 1
    assign_permissions(target, payload.permissions)
    try:
        db.flush()
        audit(
            db,
            owner,
            target,
            "admin_promoted" if payload.existing_user_id else "admin_created",
            permissions=payload.permissions,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists") from None
    return target


@router.put("/admins/{id}/permissions", response_model=UserResponse)
def update_permissions(id: UUID, payload: PermissionUpdate, owner: CurrentOwner, db: DbSession):
    owner = mutation_owner(db, owner)
    target = admin_target(db, id)
    assign_permissions(target, payload.permissions)
    audit(db, owner, target, "admin_permissions_changed", permissions=payload.permissions)
    db.commit()
    return target


@router.put("/admins/{id}/state", response_model=UserResponse)
def update_state(id: UUID, payload: AdminState, owner: CurrentOwner, db: DbSession):
    owner = mutation_owner(db, owner)
    target = admin_target(db, id)
    if target.is_active != payload.is_active:
        target.is_active = payload.is_active
        target.token_version += 1
        audit(db, owner, target, "admin_enabled" if target.is_active else "admin_disabled")
        db.commit()
    return target


@router.post("/admins/{id}/reset-password", status_code=204)
def reset_password(id: UUID, payload: TemporaryPassword, owner: CurrentOwner, db: DbSession):
    owner = mutation_owner(db, owner)
    target = admin_target(db, id)
    target.hashed_password = password_hash.hash(payload.password.get_secret_value())
    target.password_change_required = True
    target.token_version += 1
    audit(db, owner, target, "admin_password_reset")
    db.commit()


@router.post("/admins/{id}/revoke", response_model=UserResponse)
def revoke(id: UUID, owner: CurrentOwner, db: DbSession):
    owner = mutation_owner(db, owner)
    target = admin_target(db, id)
    target.role = "user"
    target.token_version += 1
    assign_permissions(target, [])
    audit(db, owner, target, "admin_revoked")
    db.commit()
    return target
