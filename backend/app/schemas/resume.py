from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.skills import SKILL_IDS
from app.schemas.profile import SkillResponse


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    original_filename: str
    content_type: str
    file_size: int
    created_at: datetime
    skills: list[SkillResponse]


class ResumeSkillsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    skill_ids: list[str] = Field(max_length=30)

    @field_validator("skill_ids")
    @classmethod
    def validate_skills(cls, value):
        if set(value) - SKILL_IDS:
            raise ValueError("Choose skills from the available vocabulary")
        return sorted(set(value))


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=30, max_length=20000)
    resume_id: UUID | None = None

    @field_validator("description")
    @classmethod
    def valid_description(cls, value):
        if len(value.strip()) < 30:
            raise ValueError("Provide at least 30 characters of job context")
        return value.strip()


class JobResponse(BaseModel):
    id: UUID
    required_skills: list[SkillResponse]
    preferred_skills: list[SkillResponse]
    role_keywords: list[str]
    matched_skills: list[SkillResponse]
    missing_skills: list[SkillResponse]
    match_percentage: int | None
    candidate_source: str
    disclaimer: str = "Baseline vocabulary matching, not an employment suitability judgment."
