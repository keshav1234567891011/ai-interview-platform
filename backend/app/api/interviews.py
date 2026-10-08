from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.interview import Interview, InterviewAnswer
from app.schemas.interview import (
    AnswerRequest,
    InterviewCreate,
    InterviewResponse,
    InterviewSummary,
)
from app.services.adaptive_questions import prepare_question
from app.services.ai_provider import QuestionProvider, ai_configured, get_question_provider
from app.services.evaluation import (
    EvaluationProvider,
    aggregate,
    get_evaluation_provider,
    persist_evaluation,
)
from app.services.interviews import (
    build_interview,
    now,
    owned_interview,
    session_response,
    summary,
)
from app.services.transcription import (
    MAX_AUDIO_BYTES,
    TranscriptionProvider,
    get_transcription_provider,
    validate_audio,
)

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])
Provider = Annotated[QuestionProvider | None, Depends(get_question_provider)]
Evaluator = Annotated[EvaluationProvider | None, Depends(get_evaluation_provider)]
Transcriber = Annotated[TranscriptionProvider | None, Depends(get_transcription_provider)]


@router.get("/capabilities")
def interview_capabilities(user: CurrentUser):
    return {"ai_available": ai_configured(), "transcription_available": ai_configured()}


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
    interview = build_interview(db, user.id, payload)
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
    evaluator: Evaluator,
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
    current.answer.input_mode = payload.input_mode
    current.answer.recording_duration_seconds = (
        payload.recording_duration_seconds if payload.input_mode == "voice" else None
    )
    if payload.submit:
        current.answer.answered_at = now()
        persist_evaluation(current, evaluator if interview.ai_enabled else None)
        if current.sequence == interview.question_count:
            interview.status = "completed"
            interview.completed_at = now()
        else:
            prepare_question(
                db, interview, interview.questions[current.sequence], provider, payload.answer_text
            )
    db.commit()
    return session_response(interview)


@router.get("/{interview_id}/results")
def interview_results(interview_id: UUID, user: CurrentUser, db: DbSession):
    interview = owned_interview(db, user.id, interview_id, lock=True)
    if interview.status != "completed":
        raise HTTPException(409, "Complete the interview before opening results")
    # Older completed sessions are upgraded conservatively without making paid calls.
    for question in interview.questions:
        if question.answer and question.answer.answered_at and not question.evaluation:
            persist_evaluation(question)
    db.commit()
    return {
        "interview": session_response(interview),
        "summary": aggregate(interview),
        "questions": [
            {
                "id": q.id,
                "sequence": q.sequence,
                "question": q.question_text,
                "category": q.category,
                "answer": q.answer.answer_text,
                "input_mode": q.answer.input_mode,
                "evaluation": q.evaluation.details["evaluation"],
            }
            for q in interview.questions
            if q.evaluation
        ],
    }


@router.post("/{interview_id}/questions/{question_id}/transcribe")
async def transcribe_answer(
    interview_id: UUID,
    question_id: UUID,
    file: UploadFile,
    user: CurrentUser,
    db: DbSession,
    provider: Transcriber,
):
    try:
        interview = owned_interview(db, user.id, interview_id)
        current = next(
            (q for q in interview.questions if not q.answer or not q.answer.answered_at), None
        )
        if interview.status != "in_progress" or not current or current.id != question_id:
            raise HTTPException(409, "Record an answer for the current active question")
        data = await file.read(MAX_AUDIO_BYTES + 1)
        duration = validate_audio(data, file.filename or "", file.content_type or "")
        if provider is None:
            raise HTTPException(
                503,
                "Server transcription is unavailable. "
                "Use browser transcription or enter your answer as text.",
            )
        try:
            # Offload synchronous provider I/O; never block the ASGI event loop.
            from starlette.concurrency import run_in_threadpool

            text = await run_in_threadpool(provider.transcribe, data)
            if not isinstance(text, str) or not 0 < len(text.strip()) <= 12000:
                raise ValueError("Invalid transcript")
        except Exception:
            raise HTTPException(
                503,
                "Transcription is temporarily unavailable. Your text answer is still available.",
            ) from None
        return {"text": text.strip(), "duration_seconds": round(duration, 2)}
    finally:
        await file.close()


@router.post("/{interview_id}/abandon", response_model=InterviewResponse)
def abandon_interview(interview_id: UUID, user: CurrentUser, db: DbSession):
    interview = owned_interview(db, user.id, interview_id, lock=True)
    if interview.status not in {"created", "in_progress"}:
        raise HTTPException(409, "This session is already closed")
    interview.status = "abandoned"
    db.commit()
    return session_response(interview)
