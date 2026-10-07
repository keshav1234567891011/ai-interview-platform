from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.skills import SKILL_IDS

Role = Literal[
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "Java Developer",
    "Python Developer",
    "Data Analyst",
    "General SDE",
]
Difficulty = Literal["Beginner", "Intermediate", "Advanced"]


class InterviewCreate(BaseModel):
    role: Role
    difficulty: Difficulty = "Intermediate"
    focus_areas: list[str] = Field(default_factory=list, max_length=18)
    question_count: int = Field(default=5, ge=1, le=10)

    @field_validator("focus_areas")
    @classmethod
    def canonical_skills(cls, value):
        if set(value) - SKILL_IDS:
            raise ValueError("Choose recognized focus areas")
        return sorted(set(value))


class AnswerRequest(BaseModel):
    answer_text: str = Field(max_length=12000)
    submit: bool = True

    @field_validator("answer_text")
    @classmethod
    def clean(cls, value):
        return value.strip()


class InterviewSummary(BaseModel):
    id: UUID
    role: str
    difficulty: str
    status: str
    created_at: datetime
    completed_at: datetime | None
    question_count: int
    answered_count: int


class QuestionResponse(BaseModel):
    id: UUID
    sequence: int
    question_text: str
    category: str
    difficulty: str
    source: str
    answer_text: str
    answered_at: datetime | None


class InterviewResponse(InterviewSummary):
    focus_areas: list[str]
    started_at: datetime | None
    duration_seconds: int | None
    current_sequence: int | None
    questions: list[QuestionResponse]
