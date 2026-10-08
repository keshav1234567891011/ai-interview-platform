from datetime import UTC
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.schedule import ScheduledInterview
from app.schemas.interview import InterviewCreate, InterviewResponse
from app.schemas.schedule import Reschedule, ScheduleCreate, ScheduleResponse
from app.services.adaptive_questions import prepare_question
from app.services.ai_provider import QuestionProvider, get_question_provider
from app.services.interviews import build_interview, now, session_response

router = APIRouter(prefix="/api/scheduled", tags=["Scheduled interviews"])


def owned(db, user_id, id, lock=False):
    query = select(ScheduledInterview).where(
        ScheduledInterview.id == id, ScheduledInterview.user_id == user_id
    )
    if lock:
        query = query.with_for_update()
    schedule = db.scalar(query)
    if not schedule:
        raise HTTPException(404, "Scheduled interview not found")
    return schedule


@router.get("", response_model=list[ScheduleResponse])
def listing(user: CurrentUser, db: DbSession):
    return db.scalars(
        select(ScheduledInterview)
        .where(ScheduledInterview.user_id == user.id)
        .order_by(ScheduledInterview.scheduled_at.desc())
        .limit(200)
    ).all()


@router.post("", response_model=ScheduleResponse, status_code=201)
def create(payload: ScheduleCreate, user: CurrentUser, db: DbSession):
    schedule = ScheduledInterview(user_id=user.id, **payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.put("/{id}", response_model=ScheduleResponse)
def reschedule(id: UUID, payload: Reschedule, user: CurrentUser, db: DbSession):
    schedule = owned(db, user.id, id, lock=True)
    if schedule.status != "scheduled":
        raise HTTPException(409, "Only pending interviews can be rescheduled")
    schedule.scheduled_at = payload.scheduled_at
    db.commit()
    return schedule


@router.post("/{id}/cancel", response_model=ScheduleResponse)
def cancel(id: UUID, user: CurrentUser, db: DbSession):
    schedule = owned(db, user.id, id, lock=True)
    if schedule.status != "scheduled":
        raise HTTPException(409, "Only pending interviews can be cancelled")
    schedule.status = "cancelled"
    db.commit()
    return schedule


@router.post("/{id}/start", response_model=InterviewResponse)
def start(
    id: UUID,
    user: CurrentUser,
    db: DbSession,
    provider: Annotated[QuestionProvider | None, Depends(get_question_provider)],
):
    schedule = owned(db, user.id, id, lock=True)
    if schedule.status != "scheduled":
        raise HTTPException(409, "This schedule is already closed")
    when = (
        schedule.scheduled_at.replace(tzinfo=UTC)
        if schedule.scheduled_at.tzinfo is None
        else schedule.scheduled_at
    )
    if when > now():
        raise HTTPException(409, "This interview is not available yet")
    interview = build_interview(
        db,
        user.id,
        InterviewCreate(
            **{field: getattr(schedule, field) for field in InterviewCreate.model_fields}
        ),
    )
    interview.status = "in_progress"
    interview.started_at = now()
    prepare_question(db, interview, interview.questions[0], provider)
    schedule.status = "started"
    schedule.interview_id = interview.id
    db.commit()
    return session_response(interview)
