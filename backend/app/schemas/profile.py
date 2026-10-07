from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.skills import SKILL_IDS


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    category: str


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    target_role: str = Field(default="", max_length=80)
    experience_level: Literal["", "beginner", "entry", "mid", "senior"] = ""
    summary: str = Field(default="", max_length=1200)
    skill_ids: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("display_name", "target_role", "summary")
    @classmethod
    def trim(cls, value: str) -> str:
        value = value.strip()
        return value

    @field_validator("display_name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        if len(value) < 2:
            raise ValueError("Display name must contain at least 2 characters")
        return value

    @field_validator("skill_ids")
    @classmethod
    def valid_skills(cls, value: list[str]) -> list[str]:
        if set(value) - SKILL_IDS:
            raise ValueError("Choose skills from the available vocabulary")
        return sorted(set(value))


class ProfileResponse(BaseModel):
    display_name: str
    email: str
    target_role: str
    experience_level: str
    summary: str
    skills: list[SkillResponse]
    completion: int
