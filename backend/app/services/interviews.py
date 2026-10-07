from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.interview import Interview
from app.models.profile import UserProfile
from app.models.resume import JobAnalysis, JobSkill, Resume
from app.schemas.interview import InterviewResponse, InterviewSummary, QuestionResponse


def candidate_skills(db: Session, user_id: UUID) -> set[str]:
    profile = db.get(UserProfile, user_id)
    ids = {skill.id for skill in profile.skills} if profile else set()
    resume = db.scalar(
        select(Resume).where(Resume.user_id == user_id).order_by(Resume.created_at.desc()).limit(1)
    )
    if resume:
        ids.update(skill.id for skill in resume.skills)
    job = db.scalar(
        select(JobAnalysis)
        .where(JobAnalysis.user_id == user_id)
        .order_by(JobAnalysis.created_at.desc())
        .limit(1)
    )
    if job:
        ids.update(db.scalars(select(JobSkill.skill_id).where(JobSkill.job_id == job.id)).all())
    return ids


def owned_interview(
    db: Session, user_id: UUID, interview_id: UUID, lock: bool = False
) -> Interview:
    query = select(Interview).where(Interview.id == interview_id, Interview.user_id == user_id)
    if lock:
        query = query.with_for_update()
    interview = db.scalar(query.execution_options(populate_existing=True))
    if not interview:
        raise HTTPException(404, "Interview not found")
    return interview


def summary(interview: Interview) -> InterviewSummary:
    return InterviewSummary(
        id=interview.id,
        role=interview.role,
        difficulty=interview.difficulty,
        status=interview.status,
        created_at=interview.created_at,
        completed_at=interview.completed_at,
        question_count=interview.question_count,
        answered_count=sum(bool(q.answer and q.answer.answered_at) for q in interview.questions),
    )


def session_response(interview: Interview) -> InterviewResponse:
    base = summary(interview)
    current = base.answered_count + 1 if interview.status in {"created", "in_progress"} else None
    duration = None
    if interview.started_at and interview.completed_at:
        duration = max(0, int((interview.completed_at - interview.started_at).total_seconds()))
    # Future questions are withheld so candidates cannot read ahead or receive hidden prompts.
    visible = [q for q in interview.questions if current is None or q.sequence <= current]
    return InterviewResponse(
        **base.model_dump(),
        ai_enabled=interview.ai_enabled,
        focus_areas=interview.focus_areas,
        started_at=interview.started_at,
        duration_seconds=duration,
        current_sequence=current,
        questions=[
            QuestionResponse(
                id=q.id,
                sequence=q.sequence,
                question_text=q.question_text,
                category=q.category,
                difficulty=q.difficulty,
                source=q.source,
                answer_text=q.answer.answer_text if q.answer else "",
                answered_at=q.answer.answered_at if q.answer else None,
            )
            for q in visible
        ],
    )


def now() -> datetime:
    return datetime.now(UTC)
