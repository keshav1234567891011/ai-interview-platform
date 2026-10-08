from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select

from app.api.dependencies import DbSession, require_permission
from app.core.permissions import has_permission
from app.models.interview import Interview
from app.models.profile import Skill, UserProfile
from app.models.resume import Resume
from app.models.schedule import ScheduledInterview
from app.models.user import User
from app.schemas.admin import AdminUserUpdate
from app.schemas.auth import UserResponse
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.schemas.schedule import ScheduleResponse
from app.services.administration import audit, lock_user
from app.services.analytics import history_item
from app.services.profile import profile_response

router = APIRouter(prefix="/api/admin", tags=["Administration"])
ViewUsers = Annotated[User, Depends(require_permission("users.view"))]
ManageUsers = Annotated[User, Depends(require_permission("users.manage"))]
SupportUsers = Annotated[User, Depends(require_permission("users.manage", "support.manage"))]
ViewAnalytics = Annotated[User, Depends(require_permission("analytics.view"))]


@router.get("")
def overview(admin: ViewAnalytics, db: DbSession):
    def count(model, *conditions):
        return db.scalar(select(func.count()).select_from(model).where(*conditions))

    return {
        "total_users": count(User),
        "active_users": count(User, User.is_active.is_(True)),
        "total_interviews": count(Interview),
        "completed_interviews": count(Interview, Interview.status == "completed"),
        "resume_count": count(Resume),
        "scheduled_interviews": count(ScheduledInterview, ScheduledInterview.status == "scheduled"),
    }


@router.get("/users", response_model=list[UserResponse])
def users(
    admin: ViewUsers,
    db: DbSession,
    search: str = Query(default="", max_length=100),
    offset: int = Query(default=0, ge=0, le=100000),
):
    query = select(User)
    if admin.role != "owner":
        query = query.where(User.role != "owner")
    if search.strip():
        # Escape wildcard characters; bound parameters prevent SQL injection.
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(
            or_(
                User.email.ilike(f"%{escaped}%", escape="\\"),
                User.display_name.ilike(f"%{escaped}%", escape="\\"),
            )
        )
    return db.scalars(query.order_by(User.created_at.desc()).offset(offset).limit(50)).all()


def find_user(db, id):
    user = db.get(User, id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.get("/users/{id}")
def detail(id: UUID, admin: ViewUsers, db: DbSession):
    user = find_user(db, id)
    if user.role == "owner" and admin.role != "owner":
        raise HTTPException(403, "Owner account access is restricted")
    return {
        "user": UserResponse.model_validate(user),
        "profile": profile_response(db, user),
        "interviews": [
            history_item(item)
            for item in (
                db.scalars(
                    select(Interview)
                    .where(Interview.user_id == id)
                    .order_by(Interview.created_at.desc())
                    .limit(50)
                ).all()
                if has_permission(admin, "interviews.view")
                else []
            )
        ],
        "resumes": [
            {
                "id": item.id,
                "filename": item.original_filename,
                "content_type": item.content_type,
                "file_size": item.file_size,
                "created_at": item.created_at,
            }
            for item in (
                db.scalars(
                    select(Resume)
                    .where(Resume.user_id == id)
                    .order_by(Resume.created_at.desc())
                    .limit(50)
                ).all()
                if has_permission(admin, "resumes.view")
                else []
            )
        ],
        "scheduled": [
            ScheduleResponse.model_validate(item)
            for item in (
                db.scalars(
                    select(ScheduledInterview)
                    .where(ScheduledInterview.user_id == id)
                    .order_by(ScheduledInterview.scheduled_at.desc())
                    .limit(50)
                ).all()
                if has_permission(admin, "interviews.view")
                else []
            )
        ],
    }


@router.put("/users/{id}", response_model=UserResponse)
def update(id: UUID, payload: AdminUserUpdate, admin: SupportUsers, db: DbSession):
    user = lock_user(db, id)
    if user.role in {"owner", "admin"}:
        raise HTTPException(
            409, "Privileged accounts cannot be edited through candidate management"
        )
    if payload.is_active is not None and not has_permission(admin, "users.manage"):
        raise HTTPException(403, "Account activation requires users.manage")
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.is_active is not None and payload.is_active != user.is_active:
        user.is_active = payload.is_active
        user.token_version += 1
    audit(db, admin, user, "user_updated")
    db.commit()
    return user


@router.put("/users/{id}/profile", response_model=ProfileResponse)
def update_profile(id: UUID, payload: ProfileUpdate, admin: ManageUsers, db: DbSession):
    user = lock_user(db, id)
    if user.role != "user":
        raise HTTPException(409, "Only candidate profiles may be managed here")
    profile = db.get(UserProfile, id)
    if profile is None:
        profile = UserProfile(user_id=id)
        db.add(profile)
    user.display_name = payload.display_name
    profile.target_role = payload.target_role
    profile.experience_level = payload.experience_level
    profile.summary = payload.summary
    profile.skills = list(db.scalars(select(Skill).where(Skill.id.in_(payload.skill_ids))).all())
    audit(db, admin, user, "user_updated")
    db.commit()
    return profile_response(db, user)
