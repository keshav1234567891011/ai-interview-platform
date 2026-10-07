from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.models.profile import Skill, UserProfile
from app.models.resume import JobAnalysis, JobSkill, Resume
from app.schemas.profile import SkillResponse
from app.schemas.resume import JobRequest, JobResponse, ResumeResponse, ResumeSkillsUpdate
from app.services.resume_parser import MAX_FILE_SIZE, extract_resume, validate_upload
from app.services.skill_analysis import analyze_job, extract_skills, match_skills
from app.services.storage import ResumeStorage, get_storage

router = APIRouter(prefix="/api", tags=["Resume and job analysis"])


def owned_resume(db, user, resume_id):
    resume = db.scalar(select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id))
    if not resume:
        raise HTTPException(404, "Resume not found")
    return resume


@router.get("/resumes", response_model=list[ResumeResponse])
def list_resumes(user: CurrentUser, db: DbSession):
    return db.scalars(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc()).limit(20)
    ).all()


@router.post("/resumes", response_model=ResumeResponse, status_code=201)
def upload_resume(
    file: UploadFile,
    user: CurrentUser,
    db: DbSession,
    storage: Annotated[ResumeStorage, Depends(get_storage)],
):
    data = file.file.read(MAX_FILE_SIZE + 1)
    name, mime = validate_upload(file.filename or "", file.content_type, data)
    text = extract_resume(data, mime)
    ids = extract_skills(text)
    key = storage.save(data, "pdf" if mime == "application/pdf" else "docx")
    resume = Resume(
        user_id=user.id,
        original_filename=name,
        content_type=mime,
        file_size=len(data),
        storage_key=key,
        extracted_text=text,
    )
    resume.skills = list(db.scalars(select(Skill).where(Skill.id.in_(ids))).all())
    db.add(resume)
    try:
        db.commit()
        db.refresh(resume)
    except Exception:
        db.rollback()
        storage.delete(key)
        raise
    return resume


@router.put("/resumes/{resume_id}/skills", response_model=ResumeResponse)
def update_resume_skills(
    resume_id: UUID, payload: ResumeSkillsUpdate, user: CurrentUser, db: DbSession
):
    resume = owned_resume(db, user, resume_id)
    resume.skills = list(db.scalars(select(Skill).where(Skill.id.in_(payload.skill_ids))).all())
    db.commit()
    return resume


@router.post("/jobs/analyze", response_model=JobResponse, status_code=201)
def job_analysis(payload: JobRequest, user: CurrentUser, db: DbSession):
    profile = db.get(UserProfile, user.id)
    resume = (
        owned_resume(db, user, payload.resume_id)
        if payload.resume_id
        else db.scalar(
            select(Resume)
            .where(Resume.user_id == user.id)
            .order_by(Resume.created_at.desc())
            .limit(1)
        )
    )
    candidate = (
        [skill.id for skill in resume.skills]
        if resume
        else [skill.id for skill in profile.skills]
        if profile
        else []
    )
    result = analyze_job(payload.description)
    job = JobAnalysis(
        user_id=user.id, description=payload.description, role_keywords=result["role_keywords"]
    )
    db.add(job)
    db.flush()
    for requirement in ["required", "preferred"]:
        db.add_all(
            JobSkill(job_id=job.id, skill_id=id, requirement=requirement)
            for id in result[requirement]
        )
    db.commit()
    match = match_skills(candidate, result["required"])
    vocabulary = {
        skill.id: SkillResponse.model_validate(skill) for skill in db.scalars(select(Skill)).all()
    }
    return JobResponse(
        id=job.id,
        required_skills=[vocabulary[id] for id in result["required"]],
        preferred_skills=[vocabulary[id] for id in result["preferred"]],
        role_keywords=result["role_keywords"],
        matched_skills=[vocabulary[id] for id in match["matched"]],
        missing_skills=[vocabulary[id] for id in match["missing"]],
        match_percentage=match["percentage"],
        candidate_source="resume" if resume else "profile",
    )
