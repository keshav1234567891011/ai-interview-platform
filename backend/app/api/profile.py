from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.models.interview import Interview
from app.models.profile import Skill, UserProfile
from app.schemas.profile import ProfileResponse, ProfileUpdate, SkillResponse
from app.services.interviews import summary
from app.services.profile import profile_response

router = APIRouter(prefix="/api", tags=["Candidate workspace"])


@router.get("/skills", response_model=list[SkillResponse])
def skills(user: CurrentUser, db: DbSession):
    return db.scalars(select(Skill).order_by(Skill.name)).all()


@router.get("/profile", response_model=ProfileResponse)
def get_profile(user: CurrentUser, db: DbSession):
    return profile_response(db, user)


@router.put("/profile", response_model=ProfileResponse)
def update_profile(payload: ProfileUpdate, user: CurrentUser, db: DbSession):
    profile = db.get(UserProfile, user.id)
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    user.display_name = payload.display_name
    profile.target_role = payload.target_role
    profile.experience_level = payload.experience_level
    profile.summary = payload.summary
    profile.skills = list(db.scalars(select(Skill).where(Skill.id.in_(payload.skill_ids))).all())
    db.commit()
    return profile_response(db, user)


@router.get("/dashboard")
def dashboard(user: CurrentUser, db: DbSession):
    profile = profile_response(db, user)
    recent = db.scalars(
        select(Interview)
        .where(Interview.user_id == user.id)
        .order_by(Interview.created_at.desc())
        .limit(5)
    ).all()
    count = db.scalar(
        select(func.count()).select_from(Interview).where(Interview.user_id == user.id)
    )
    return {
        "profile": profile,
        "recent_interviews": [summary(item) for item in recent],
        "interview_count": count,
    }
