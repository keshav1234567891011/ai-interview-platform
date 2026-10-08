from datetime import UTC, datetime
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, field_validator

from app.schemas.interview import InterviewCreate


class ScheduleCreate(InterviewCreate):
    model_config = ConfigDict(extra="forbid")
    scheduled_at: AwareDatetime

    @field_validator("scheduled_at")
    @classmethod
    def future_time(cls, value: datetime):
        if value <= datetime.now(UTC):
            raise ValueError("Choose a future date and time")
        return value.astimezone(UTC)


class Reschedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scheduled_at: AwareDatetime

    @field_validator("scheduled_at")
    @classmethod
    def future_time(cls, value: datetime):
        return ScheduleCreate.future_time(value)


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    role: str
    difficulty: str
    focus_areas: list[str]
    question_count: int
    ai_enabled: bool
    scheduled_at: datetime
    status: str
    interview_id: UUID | None
    created_at: datetime

    @field_validator("scheduled_at", "created_at", mode="before")
    @classmethod
    def utc(cls, value: datetime):
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
