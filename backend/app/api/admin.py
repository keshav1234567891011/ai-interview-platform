from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select

from app.api.dependencies import CurrentAdmin, DbSession
from app.models.interview import Interview
from app.models.resume import Resume
from app.models.schedule import ScheduledInterview
from app.models.user import User
from app.schemas.admin import AdminUserUpdate
from app.schemas.auth import UserResponse
from app.schemas.schedule import ScheduleResponse
from app.services.analytics import history_item
from app.services.profile import profile_response

router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.get("")
def overview(admin: CurrentAdmin, db: DbSession):
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
    admin: CurrentAdmin,
    db: DbSession,
    search: str = Query(default="", max_length=100),
    offset: int = Query(default=0, ge=0, le=100000),
):
    query = select(User)
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
def detail(id: UUID, admin: CurrentAdmin, db: DbSession):
    user = find_user(db, id)
    return {
        "user": UserResponse.model_validate(user),
        "profile": profile_response(db, user),
        "interviews": [
            history_item(item)
            for item in db.scalars(
                select(Interview)
                .where(Interview.user_id == id)
                .order_by(Interview.created_at.desc())
                .limit(50)
            ).all()
        ],
        "resumes": [
            {
                "id": item.id,
                "filename": item.original_filename,
                "content_type": item.content_type,
                "file_size": item.file_size,
                "created_at": item.created_at,
            }
            for item in db.scalars(
                select(Resume)
                .where(Resume.user_id == id)
                .order_by(Resume.created_at.desc())
                .limit(50)
            ).all()
        ],
        "scheduled": [
            ScheduleResponse.model_validate(item)
            for item in db.scalars(
                select(ScheduledInterview)
                .where(ScheduledInterview.user_id == id)
                .order_by(ScheduledInterview.scheduled_at.desc())
                .limit(50)
            ).all()
        ],
    }


@router.put("/users/{id}", response_model=UserResponse)
def update(id: UUID, payload: AdminUserUpdate, admin: CurrentAdmin, db: DbSession):
    user = find_user(db, id)
    if payload.is_active is False and user.role == "admin":
        raise HTTPException(409, "Admin accounts cannot be deactivated through this interface")
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.is_active is not None and payload.is_active != user.is_active:
        user.is_active = payload.is_active
        user.token_version += 1
    db.commit()
    return user
