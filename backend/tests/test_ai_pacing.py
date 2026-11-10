import json
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest
from google.genai import errors
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rate_limit import bucket_key
from app.models.administration import AuditEvent
from app.models.interview import Interview
from app.models.rate_limit import RateLimitBucket
from app.models.user import User
from app.schemas.evaluation import RubricEvaluation


@pytest.fixture
def sdk(monkeypatch, client, account):
    monkeypatch.setenv("GEMINI_API_KEY", "synthetic-test-key")
    get_settings.cache_clear()
    calls, contexts = [], []
    failure = [None]
    prompts = [
        "Explain the trade-offs when indexing a selective SQL lookup.",
        "Why must a database maintain its index when a new record is inserted?",
        "How would you choose the order of columns in a composite index?",
        "What evidence in an execution plan suggests a sequential scan is appropriate?",
        "When does a covering index reduce heap access, and what does visibility require?",
    ]
    rubric = RubricEvaluation(
        technical_score=35,
        coverage_score=40,
        reasoning_score=30,
        practical_score=20,
        communication_score=60,
        strengths=["States an approach"],
        weaknesses=["Explain indexed write maintenance"],
        concepts_covered=["index"],
        concepts_missed=["write amplification"],
        feedback="Index maintenance adds work to writes.",
        improvement_suggestion="Compare read benefits with storage and write costs.",
        sample_answer=(
            "An index accelerates selective reads but costs storage and write maintenance."
        ),
    )

    class Models:
        def generate_content(self, **kwargs):
            assert kwargs["model"] == "gemini-3.1-flash-lite"
            title = kwargs["config"].response_json_schema["title"]
            calls.append(title)
            if title == "RubricEvaluation":
                if failure[0]:
                    raise failure[0]
                return SimpleNamespace(text=rubric.model_dump_json())
            context = json.loads(kwargs["contents"].split("\n", 1)[1].rsplit("\n", 1)[0])
            contexts.append(context)
            return SimpleNamespace(
                text=json.dumps(
                    {
                        "question": prompts[len(contexts) - 1],
                        "category": "sql",
                        "difficulty": context["difficulty"],
                    }
                )
            )

    class Client:
        models = Models()

        def __init__(self, **kwargs):
            assert kwargs["http_options"].retry_options.attempts == 1

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    monkeypatch.setattr("app.services.ai_provider.genai.Client", Client)
    return SimpleNamespace(calls=calls, contexts=contexts, failure=failure)


def create(client):
    result = client.post(
        "/api/interviews",
        json={
            "role": "Backend Developer",
            "difficulty": "Intermediate",
            "question_count": 5,
            "focus_areas": ["sql"],
            "ai_enabled": True,
        },
    )
    assert result.status_code == 201
    return "/api/interviews/" + result.json()["id"]


def real_budget(monkeypatch):
    settings = get_settings().model_copy(update={"app_env": "development"})
    clock = [600000]
    monkeypatch.setattr("app.core.rate_limit.get_settings", lambda: settings)
    monkeypatch.setattr("app.core.rate_limit.time", SimpleNamespace(time=lambda: clock[0]))
    return clock


def test_five_ai_evaluations_with_real_pacing_and_saved_draft(client, account, sdk, monkeypatch):
    clock = real_budget(monkeypatch)
    base = create(client)
    session = client.post(base + "/start").json()
    # Refresh/repeated start consumes no AI turn and does not regenerate the question.
    assert client.post(base + "/start").status_code == 200
    assert len(sdk.calls) == 1
    pacing = 0
    for index in range(5):
        current = session["questions"][-1]
        path = f"{base}/questions/{current['id']}/answer"
        payload = {"answer_text": f"Synthetic practice answer number {index + 1}."}
        before = len(sdk.calls)
        response = client.put(path, json=payload)
        if response.status_code == 429:
            pacing += 1
            assert response.headers["X-InterviewAI-AI-Reason"] == "budget_minute"
            assert len(sdk.calls) == before
            saved = client.get(base).json()
            assert saved["questions"][-1]["answer_text"] == payload["answer_text"]
            assert saved["questions"][-1]["answered_at"] is None
            assert saved["answered_count"] == index
            clock[0] += int(response.headers["Retry-After"])
            response = client.put(path, json=payload)
        assert response.status_code == 200
        session = response.json()
        calls = len(sdk.calls)
        assert client.put(path, json=payload).status_code == 409
        assert len(sdk.calls) == calls
    assert pacing == 2
    assert len(sdk.calls) == 10  # Exactly five question + five evaluation requests.
    assert sdk.calls.count("RubricEvaluation") == 5
    assert all(
        c["previous_evaluation"]["concepts_missed"] == ["write amplification"]
        for c in sdk.contexts[1:]
    )
    assert all("sample_answer" not in c["previous_evaluation"] for c in sdk.contexts[1:])
    first = client.get(base + "/results").json()
    assert client.get(base + "/results").json() == first
    assert len(sdk.calls) == 10
    assert all(q["evaluation"]["source"] == "ai" for q in first["questions"])
    assert all(q["evaluation"]["fallback_reason"] is None for q in first["questions"])
    assert all(q["question_source"] == "ai" for q in first["questions"])
    with Session(client.engine) as db:
        stored = db.get(Interview, UUID(base.rsplit("/", 1)[-1]))
        assert all(q.evaluation.source == "ai" for q in stored.questions)
        daily = db.get(RateLimitBucket, bucket_key("gemini-turns", account["id"], 86400))
        assert daily.count == 6


def test_daily_budget_still_completes_with_labeled_fallback(client, account, sdk, monkeypatch):
    clock = real_budget(monkeypatch)
    with Session(client.engine) as db:
        db.add(
            RateLimitBucket(
                key=bucket_key("gemini-turns", account["id"], 86400),
                window_start=clock[0] // 86400 * 86400,
                count=20,
            )
        )
        db.commit()
    base = create(client)
    session = client.post(base + "/start").json()
    for _ in range(5):
        q = session["questions"][-1]
        response = client.put(
            f"{base}/questions/{q['id']}/answer", json={"answer_text": "Saved practice answer."}
        )
        assert response.status_code == 200
        session = response.json()
    results = client.get(base + "/results").json()
    assert sdk.calls == []
    assert all(
        q["evaluation"]["source"] == "deterministic"
        and q["evaluation"]["fallback_reason"] == "budget_daily"
        for q in results["questions"]
    )


@pytest.mark.parametrize(
    "failure,reason",
    [
        (errors.ClientError(429, {"error": {"message": "private-key private-answer"}}), "quota"),
        (httpx.ReadTimeout("private-answer"), "timeout"),
        (httpx.ConnectError("private-key"), "network"),
        (ValueError("private-answer malformed JSON"), "invalid_output"),
    ],
)
def test_provider_failure_is_safe_persisted_and_visible(
    client, account, sdk, failure, reason, caplog
):
    sdk.failure[0] = failure
    base = create(client)
    session = client.post(base + "/start").json()
    q = session["questions"][0]
    result = client.put(
        f"{base}/questions/{q['id']}/answer", json={"answer_text": "private-answer"}
    )
    assert result.status_code == 200
    with Session(client.engine) as db:
        stored = db.get(Interview, UUID(base.rsplit("/", 1)[-1]))
        evaluation = stored.questions[0].evaluation.details["evaluation"]
        assert evaluation["source"] == "deterministic" and evaluation["fallback_reason"] == reason
        assert stored.questions[0].source == "ai"  # Question provenance is independent.
        if reason != "invalid_output":
            assert len(sdk.calls) == 2  # No immediate second failing call for the follow-up.
            assert stored.questions[1].source == "question_bank"
        db.get(User, UUID(account["id"])).role = "owner"
        events = db.scalars(select(AuditEvent).where(AuditEvent.action == "gemini_fallback")).all()
        assert events and all("private" not in json.dumps(e.details) for e in events)
        db.commit()
    diagnostics = client.get("/api/owner/ai-settings").json()["gemini_diagnostics"]
    assert any(d["operation"] == "evaluation" and d["reason"] == reason for d in diagnostics)
    assert "reason=" + reason in caplog.text
    assert "private-key" not in caplog.text and "private-answer" not in caplog.text
