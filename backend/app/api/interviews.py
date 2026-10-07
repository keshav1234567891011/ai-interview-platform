from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.interview import Interview, InterviewAnswer, InterviewQuestion
from app.schemas.interview import (
    AnswerRequest,
    InterviewCreate,
    InterviewResponse,
    InterviewSummary,
)
from app.services.adaptive_questions import prepare_question
from app.services.ai_provider import QuestionProvider, ai_configured, get_question_provider
from app.services.interviews import (
    candidate_skills,
    now,
    owned_interview,
    session_response,
    summary,
)
from app.services.question_bank import select_questions

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])
Provider = Annotated[QuestionProvider | None, Depends(get_question_provider)]


@router.get("/capabilities")
def interview_capabilities(user: CurrentUser):
    return {"ai_available": ai_configured()}


@router.get("", response_model=list[InterviewSummary])
def list_interviews(user: CurrentUser, db: DbSession):
    return [
        summary(item)
        for item in db.scalars(
            select(Interview)
            .where(Interview.user_id == user.id)
            .order_by(Interview.created_at.desc())
            .limit(50)
        ).all()
    ]


@router.post("", response_model=InterviewResponse, status_code=201)
def create_interview(payload: InterviewCreate, user: CurrentUser, db: DbSession):
    selected = select_questions(
        payload.role,
        payload.difficulty,
        payload.focus_areas,
        candidate_skills(db, user.id),
        payload.question_count,
    )
    if len(selected) != payload.question_count:
        raise HTTPException(422, "Not enough distinct questions for this selection")
    interview = Interview(
        user_id=user.id,
        role=payload.role,
        difficulty=payload.difficulty,
        focus_areas=payload.focus_areas,
        question_count=payload.question_count,
        ai_enabled=payload.ai_enabled,
    )
    interview.questions = [
        InterviewQuestion(
            sequence=index, question_text=q.question, category=q.skill, difficulty=q.difficulty
        )
        for index, q in enumerate(selected, 1)
    ]
    db.add(interview)
    db.commit()
    return session_response(interview)


@router.get("/{interview_id}", response_model=InterviewResponse)
def get_interview(interview_id: UUID, user: CurrentUser, db: DbSession):
    return session_response(owned_interview(db, user.id, interview_id))


@router.post("/{interview_id}/start", response_model=InterviewResponse)
def start_interview(interview_id: UUID, user: CurrentUser, db: DbSession, provider: Provider):
    interview = owned_interview(db, user.id, interview_id, lock=True)
    if interview.status not in {"created", "in_progress"}:
        raise HTTPException(409, "This session is already closed")
    if interview.status == "created":
        interview.status = "in_progress"
        interview.started_at = now()
        prepare_question(db, interview, interview.questions[0], provider)
        db.commit()
    return session_response(interview)


@router.put("/{interview_id}/questions/{question_id}/answer", response_model=InterviewResponse)
def answer_question(
    interview_id: UUID,
    question_id: UUID,
    payload: AnswerRequest,
    user: CurrentUser,
    db: DbSession,
    provider: Provider,
):
    interview = owned_interview(db, user.id, interview_id, lock=True)
    if interview.status != "in_progress":
        raise HTTPException(409, "Only an active interview accepts answers")
    current = next(
        (q for q in interview.questions if not q.answer or not q.answer.answered_at), None
    )
    if not current or current.id != question_id:
        raise HTTPException(409, "Answer the current question before moving forward")
    if payload.submit and not payload.answer_text:
        raise HTTPException(422, "Write an answer before submitting")
    if not current.answer:
        current.answer = InterviewAnswer(answer_text=payload.answer_text)
    current.answer.answer_text = payload.answer_text
    current.answer.updated_at = now()
    if payload.submit:
        current.answer.answered_at = now()
        if current.sequence == interview.question_count:
            interview.status = "completed"
            interview.completed_at = now()
        else:
            prepare_question(
                db, interview, interview.questions[current.sequence], provider, payload.answer_text
            )
    db.commit()
    return session_response(interview)


@router.post("/{interview_id}/abandon", response_model=InterviewResponse)
def abandon_interview(interview_id: UUID, user: CurrentUser, db: DbSession):
    interview = owned_interview(db, user.id, interview_id, lock=True)
    if interview.status not in {"created", "in_progress"}:
        raise HTTPException(409, "This session is already closed")
    interview.status = "abandoned"
    db.commit()
    return session_response(interview)
