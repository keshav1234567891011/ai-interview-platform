from sqlalchemy.orm import Session

from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.profile import ProfileResponse, SkillResponse


def profile_response(db: Session, user: User) -> ProfileResponse:
    profile = db.get(UserProfile, user.id)
    skills = sorted(profile.skills, key=lambda s: s.name) if profile else []
    completed = sum(
        [
            bool(user.display_name),
            bool(profile and profile.target_role),
            bool(profile and profile.experience_level),
            bool(skills),
        ]
    )
    return ProfileResponse(
        display_name=user.display_name,
        email=user.email,
        target_role=profile.target_role if profile else "",
        experience_level=profile.experience_level if profile else "",
        summary=profile.summary if profile else "",
        skills=[SkillResponse.model_validate(skill) for skill in skills],
        completion=completed * 25,
    )
