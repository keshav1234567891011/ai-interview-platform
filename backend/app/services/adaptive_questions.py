import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.interview import Interview, InterviewQuestion
from app.models.profile import UserProfile
from app.models.resume import JobAnalysis, Resume
from app.services.ai_provider import CandidateContext, GeneratedQuestion, QuestionProvider
from app.services.interviews import candidate_skills
from app.services.question_bank import ROLE_SKILLS, select_questions


def adaptive_difficulty(base: str, answer: str) -> str:
    """A transparent effort signal, not a technical correctness or ability assessment."""
    words = re.findall(r"\b\w+\b", answer)
    levels = ["Beginner", "Intermediate", "Advanced"]
    level = levels.index(base)
    if len(words) < 20:
        return levels[max(0, level - 1)]
    # Longer, varied explanations with concrete reasoning can invite a deeper prompt.
    markers = {
        term
        for term in ("because", "example", "complexity", "trade-off", "however", "edge case")
        if term in answer.casefold()
    }
    if len(words) >= 80 and len(set(words)) >= 35 and len(markers) >= 2:
        return levels[min(2, level + 1)]
    return base


def duplicate_question(text: str, existing: list[str]) -> bool:
    def normalized(value):
        return " ".join(re.findall(r"\w+", value.casefold()))

    current = normalized(text)
    tokens = set(current.split())
    for other in existing:
        previous = normalized(other)
        previous_tokens = set(previous.split())
        if (
            current == previous
            or len(tokens & previous_tokens) / max(1, len(tokens | previous_tokens)) >= 0.8
        ):
            return True
    return False


def context_for(db: Session, interview: Interview, difficulty: str) -> CandidateContext:
    profile = db.get(UserProfile, interview.user_id)
    resume = db.scalar(
        select(Resume)
        .where(Resume.user_id == interview.user_id)
        .order_by(Resume.created_at.desc())
        .limit(1)
    )
    job = db.scalar(
        select(JobAnalysis)
        .where(JobAnalysis.user_id == interview.user_id)
        .order_by(JobAnalysis.created_at.desc())
        .limit(1)
    )
    submitted = [q for q in interview.questions if q.answer and q.answer.answered_at]
    return CandidateContext(
        role=interview.role,
        difficulty=difficulty,
        focus_areas=interview.focus_areas,
        skills=sorted(candidate_skills(db, interview.user_id)),
        profile_summary=profile.summary[:1200] if profile else "",
        resume_excerpt=resume.extracted_text[:4000] if resume else "",
        job_excerpt=job.description[:4000] if job else "",
        previous_questions=[q.question_text for q in submitted],
        previous_answers=[q.answer.answer_text[:2000] for q in submitted[-3:]],
    )


def prepare_question(
    db: Session,
    interview: Interview,
    target: InterviewQuestion,
    provider: QuestionProvider | None,
    previous_answer: str = "",
) -> None:
    if not interview.ai_enabled:
        return
    difficulty = (
        adaptive_difficulty(interview.difficulty, previous_answer)
        if previous_answer
        else interview.difficulty
    )
    other_prompts = [q.question_text for q in interview.questions if q.id != target.id]
    skills = candidate_skills(db, interview.user_id)
    # Fallback is selected before network work; never discard the stored session on provider errors.
    alternatives = select_questions(
        interview.role, difficulty, interview.focus_areas, skills, 54, set(other_prompts)
    )
    fallback = next(
        (q for q in alternatives if not duplicate_question(q.question, other_prompts)), None
    )
    if fallback:
        target.question_text = fallback.question
        target.category = fallback.skill
        target.difficulty = fallback.difficulty
        target.source = "question_bank"
    if provider is None:
        return
    try:
        result = GeneratedQuestion.model_validate(
            provider.generate(context_for(db, interview, difficulty))
        )
        allowed = ROLE_SKILLS[interview.role] | skills | set(interview.focus_areas)
        if (
            result.difficulty != difficulty
            or result.category not in allowed
            or duplicate_question(result.question, other_prompts)
        ):
            return
        target.question_text = result.question
        target.category = result.category
        target.difficulty = result.difficulty
        target.source = "ai"
    except Exception:
        # Do not log provider exceptions: they can contain private prompts or transport headers.
        logging.getLogger("interviewai").warning("question_provider_fallback")
        return
