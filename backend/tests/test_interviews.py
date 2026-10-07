from uuid import UUID

from sqlalchemy.orm import Session

from app.models.interview import Interview
from app.services.question_bank import BANK, ROLE_SKILLS, select_questions


def create(client, **options):
    response = client.post(
        "/api/interviews",
        json={
            "role": "Backend Developer",
            "difficulty": "Intermediate",
            "question_count": 3,
            **options,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_bank_uniqueness_and_role_difficulty_coverage():
    assert len({q.question for q in BANK}) == len(BANK)
    for role in ROLE_SKILLS:
        for difficulty in ["Beginner", "Intermediate", "Advanced"]:
            selected = select_questions(role, difficulty, [], set(), 10)
            assert len(selected) == 10
            assert len({q.question for q in selected}) == 10
            assert selected[0].difficulty == difficulty
    assert (
        select_questions("Backend Developer", "Intermediate", ["python"], {"sql"}, 1)[0].skill
        == "python"
    )


def test_interview_creation_and_validation(client, account):
    interview = create(client, focus_areas=["sql"])
    assert interview["status"] == "created"
    assert interview["questions"][0]["category"] == "sql"
    assert len(interview["questions"]) == 1  # Future prompts are not public.
    with Session(client.engine) as db:
        stored = db.get(Interview, UUID(interview["id"]))
        assert len(stored.questions) == 3
        assert len({q.question_text for q in stored.questions}) == 3
    for payload in [
        {"role": "Invalid"},
        {"role": "Backend Developer", "question_count": 11},
        {"role": "Backend Developer", "focus_areas": ["invalid"]},
    ]:
        assert client.post("/api/interviews", json=payload).status_code == 422


def test_draft_recovery_submission_completion_and_history(client, account):
    created = create(client, question_count=2)
    base = f"/api/interviews/{created['id']}"
    started = client.post(f"{base}/start").json()
    assert started["status"] == "in_progress"
    first = started["questions"][0]
    path = f"{base}/questions/{first['id']}/answer"
    assert (
        client.put(path, json={"answer_text": "A recoverable draft", "submit": False}).status_code
        == 200
    )
    recovered = client.get(base).json()
    assert recovered["answered_count"] == 0
    assert recovered["questions"][0]["answer_text"] == "A recoverable draft"
    assert client.put(path, json={"answer_text": "  "}).status_code == 422
    next_state = client.put(path, json={"answer_text": "My completed explanation."}).json()
    assert next_state["current_sequence"] == 2
    assert (
        client.put(path, json={"answer_text": "Cannot overwrite a submitted answer"}).status_code
        == 409
    )
    second = next_state["questions"][1]
    completed = client.put(
        f"{base}/questions/{second['id']}/answer", json={"answer_text": "A second explanation."}
    ).json()
    assert completed["status"] == "completed"
    assert completed["answered_count"] == 2
    assert completed["duration_seconds"] >= 0
    assert "score" not in completed
    assert client.post(f"{base}/start").status_code == 409
    assert client.post(f"{base}/abandon").status_code == 409
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["interview_count"] == 1
    assert dashboard["recent_interviews"][0]["status"] == "completed"


def test_state_transitions_and_sequence_guard(client, account):
    interview = create(client)
    base = f"/api/interviews/{interview['id']}"
    with Session(client.engine) as db:
        second_id = db.get(Interview, UUID(interview["id"])).questions[1].id
    assert (
        client.put(
            f"{base}/questions/{second_id}/answer", json={"answer_text": "Skipped"}
        ).status_code
        == 409
    )
    assert client.post(f"{base}/start").status_code == 200
    assert client.post(f"{base}/start").status_code == 200
    assert (
        client.put(
            f"{base}/questions/{second_id}/answer", json={"answer_text": "Skipped"}
        ).status_code
        == 409
    )
    assert client.post(f"{base}/abandon").json()["status"] == "abandoned"
    assert client.post(f"{base}/start").status_code == 409


def test_interview_authorization_and_isolation(client, account):
    interview = create(client)
    client.post(
        "/api/auth/register",
        json={
            "email": "second@example.com",
            "display_name": "Other Candidate",
            "password": "Other-test-password42",
        },
    )
    base = f"/api/interviews/{interview['id']}"
    assert client.get(base).status_code == 404
    assert client.post(f"{base}/start").status_code == 404
    assert client.post(f"{base}/abandon").status_code == 404
    assert (
        client.put(
            f"{base}/questions/{interview['questions'][0]['id']}/answer",
            json={"answer_text": "Attempt"},
        ).status_code
        == 404
    )
    assert client.get("/api/interviews").json() == []
    assert client.get("/api/dashboard").json()["interview_count"] == 0
    client.post("/api/auth/logout")
    assert client.get("/api/interviews").status_code == 401


def test_selection_considers_profile_resume_and_job(client, account, monkeypatch):
    from app.models.profile import Skill, UserProfile
    from app.models.resume import JobAnalysis, JobSkill, Resume
    from app.services.interviews import candidate_skills

    with Session(client.engine) as db:
        user_id = UUID(account["id"])
        db.add(UserProfile(user_id=user_id, skills=[db.get(Skill, "python")]))
        db.add(
            Resume(
                user_id=user_id,
                original_filename="synthetic.pdf",
                storage_key="unused",
                content_type="application/pdf",
                file_size=1,
                extracted_text="",
                skills=[db.get(Skill, "sql")],
            )
        )
        job = JobAnalysis(user_id=user_id, description="synthetic job", role_keywords=[])
        db.add(job)
        db.flush()
        db.add(JobSkill(job_id=job.id, skill_id="docker", requirement="required"))
        db.commit()
        assert candidate_skills(db, user_id) == {"python", "sql", "docker"}
