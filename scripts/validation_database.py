"""Check/clean only a generated live-browser account; never display private settings."""

import json
import re
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main() -> None:
    from sqlalchemy import delete, event, select
    from sqlalchemy.orm import Session

    from app.db.session import get_engine
    from app.models.interview import Interview
    from app.models.profile import UserProfile
    from app.models.user import User

    request = json.load(sys.stdin)
    email = request["email"]
    if not re.fullmatch(r"interviewai-validation-[a-f0-9]{32}@example\.com", email):
        raise ValueError("Only generated validation accounts are permitted")
    engine = get_engine()

    @event.listens_for(engine, "do_connect")
    def bounded_connection(dialect, record, args, parameters):
        parameters["connect_timeout"] = 5

    try:
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == email))
            if user is not None:
                assert user.display_name.startswith("InterviewAI validation")
                if request.get("user_id"):
                    assert user.id == UUID(request["user_id"])
            action = request["action"]
            if action == "cleanup":
                if user is not None:
                    # Database FK cascades remove this user's profile/interview records only.
                    db.execute(delete(User).where(User.id == user.id, User.email == email))
                    db.commit()
                assert db.scalar(select(User.id).where(User.email == email)) is None
            elif action == "profile":
                assert user is not None and user.hashed_password.startswith("$argon2id$")
                profile = db.get(UserProfile, user.id)
                assert profile is not None
                assert profile.target_role == "Backend Developer"
                assert profile.experience_level == "entry"
                assert profile.summary == "Temporary browser validation of local persistence."
                assert sorted(skill.id for skill in profile.skills) == ["postgresql", "python"]
            elif action == "interview":
                assert user is not None
                interview = db.scalar(
                    select(Interview).where(
                        Interview.id == UUID(request["interview_id"]), Interview.user_id == user.id
                    )
                )
                assert interview is not None and interview.status == "in_progress"
                assert not interview.ai_enabled and interview.question_count == 3
                assert all(question.source == "question_bank" for question in interview.questions)
                submitted = [
                    question
                    for question in interview.questions
                    if question.answer is not None and question.answer.answered_at is not None
                ]
                assert len(submitted) == 1
                assert submitted[0].answer.answer_text == request["answer"]
            else:
                raise ValueError("Unsupported validation operation")
            print(json.dumps({"passed": True}))
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Raw SQL/driver/configuration exceptions may include private connection details.
        print(json.dumps({"passed": False}))
        sys.exit(1)
