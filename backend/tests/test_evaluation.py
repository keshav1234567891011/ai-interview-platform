import wave
from io import BytesIO
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from app.models.interview import Interview, InterviewAnswer, InterviewQuestion
from app.schemas.evaluation import RubricEvaluation
from app.services.communication import communication_signals
from app.services.evaluation import evaluate_answer, get_evaluation_provider
from app.services.transcription import get_transcription_provider, validate_audio


def question():
    return InterviewQuestion(
        question_text="Explain database indexes and query trade-offs.",
        category="dbms",
        difficulty="Intermediate",
        sequence=1,
        answer=InterviewAnswer(
            answer_text=(
                "An index accelerates query lookup because it avoids scanning every row. "
                "For example, index an email lookup. "
                "However, indexes add write cost and storage."
            ),
            input_mode="text",
        ),
    )


def wav(seconds=1):
    buffer = BytesIO()
    with wave.open(buffer, "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(16000)
        file.writeframes(b"\0\0" * int(16000 * seconds))
    return buffer.getvalue()


def complete(client, voice=False):
    created = client.post(
        "/api/interviews", json={"role": "Backend Developer", "question_count": 1}
    ).json()
    base = f"/api/interviews/{created['id']}"
    started = client.post(base + "/start").json()
    path = f"{base}/questions/{started['questions'][0]['id']}"
    result = client.put(
        path + "/answer",
        json={
            "answer_text": (
                "An index helps a query because lookups use an ordered structure. "
                "For example, use an email index. However, writes require maintenance."
            ),
            "input_mode": "voice" if voice else "text",
            "recording_duration_seconds": 30 if voice else None,
        },
    )
    assert result.status_code == 200
    return base, path


def test_contextual_fillers_and_pace():
    clean = communication_signals(
        "I like SQL. This is a kind of index. Sort of algorithm is a description."
    )
    assert clean.filler_count == 0
    result = communication_signals(
        "Um, uh, basically, this index helps. I mean, it speeds up reads.", 6
    )
    assert result.filler_count == 4
    assert result.words_per_minute == round(result.word_count * 10, 1)
    assert result.duration_seconds == 6
    assert "long_pauses" not in result.model_dump()
    assert communication_signals("A text-only answer").words_per_minute is None


@pytest.mark.parametrize("duration,pace", [(60, "very slow"), (30, "balanced"), (10, "very fast")])
def test_descriptive_pace(duration, pace):
    assert communication_signals("word " * 70, duration).pace == pace


def test_conservative_text_and_voice_evaluation():
    q = question()
    text = evaluate_answer(q)
    assert text.source == "deterministic" and text.technical_score <= 75
    assert 0 <= text.score <= 100
    assert text.communication.words_per_minute is None
    q.answer.input_mode = "voice"
    q.answer.recording_duration_seconds = 30
    assert evaluate_answer(q).communication.words_per_minute is not None


def test_successful_validated_ai_evaluation():
    class Provider:
        def evaluate(self, question, answer, concepts):
            return RubricEvaluation(
                technical_score=80,
                coverage_score=90,
                reasoning_score=70,
                practical_score=60,
                communication_score=85,
                strengths=["Clear example"],
                weaknesses=["Explain trade-offs"],
                concepts_missed=[],
                feedback="A clear, relevant explanation.",
                improvement_suggestion="Compare another approach and its trade-offs.",
            )

    result = evaluate_answer(question(), Provider())
    assert result.source == "ai"
    assert result.score == round(80 * 0.4 + 90 * 0.25 + 70 * 0.2 + 60 * 0.1 + 85 * 0.05)


@pytest.mark.parametrize(
    "failure",
    [
        None,
        TimeoutError(),
        RuntimeError(),
        {"technical_score": 200},
        {"hidden_reasoning": "rejected"},
    ],
)
def test_invalid_or_failed_provider_fallback(failure):
    class Provider:
        def evaluate(self, *args):
            if isinstance(failure, Exception):
                raise failure
            return failure

    assert evaluate_answer(question(), Provider()).source == "deterministic"


def test_results_aggregation_and_ownership(client, account):
    assert get_evaluation_provider() is None
    base, _ = complete(client, voice=True)
    response = client.get(base + "/results")
    assert response.status_code == 200
    report = response.json()
    assert report["summary"]["evaluated_answers"] == 1
    assert report["summary"]["score"] == report["questions"][0]["evaluation"]["score"]
    assert report["questions"][0]["evaluation"]["communication"]["duration_seconds"] == 30
    assert (
        client.get("/api/dashboard").json()["latest_evaluation"]["score"]
        == report["summary"]["score"]
    )
    with Session(client.engine) as db:
        stored = db.get(Interview, UUID(base.rsplit("/", 1)[1]))
        assert stored.questions[0].evaluation.details["version"] == 1
    client.post(
        "/api/auth/register",
        json={
            "email": "other@example.com",
            "display_name": "Other User",
            "password": "Other-test-password42",
        },
    )
    assert client.get(base + "/results").status_code == 404
    client.post("/api/auth/logout")
    assert client.get(base + "/results").status_code == 401


def test_results_not_available_before_completion(client, account):
    interview = client.post(
        "/api/interviews", json={"role": "General SDE", "question_count": 1}
    ).json()
    assert client.get(f"/api/interviews/{interview['id']}/results").status_code == 409


def test_audio_validation():
    assert validate_audio(wav(), "answer.wav", "audio/wav") == 1
    for data, filename, mime in [
        (b"malformed", "a.wav", "audio/wav"),
        (wav(301), "a.wav", "audio/wav"),
        (wav(), "a.exe", "audio/wav"),
        (wav(), "a.wav", "application/octet-stream"),
        (wav()[:-20], "a.wav", "audio/wav"),
    ]:
        with pytest.raises(Exception):
            validate_audio(data, filename, mime)


def test_transcription_mock_and_no_key(client, account):
    created = client.post(
        "/api/interviews", json={"role": "General SDE", "question_count": 1}
    ).json()
    base = f"/api/interviews/{created['id']}"
    started = client.post(base + "/start").json()
    path = f"{base}/questions/{started['questions'][0]['id']}/transcribe"
    assert get_transcription_provider() is None
    assert client.post(path, files={"file": ("answer.wav", wav(), "audio/wav")}).status_code == 503

    class Provider:
        def transcribe(self, data):
            return "An index accelerates lookup."

    client.application.dependency_overrides[get_transcription_provider] = lambda: Provider()
    response = client.post(path, files={"file": ("answer.wav", wav(), "audio/wav")})
    assert response.json() == {"text": "An index accelerates lookup.", "duration_seconds": 1}
    assert client.post(path, files={"file": ("answer.wav", b"bad", "audio/wav")}).status_code == 422

    class Failure:
        def transcribe(self, data):
            raise TimeoutError()

    client.application.dependency_overrides[get_transcription_provider] = lambda: Failure()
    assert client.post(path, files={"file": ("answer.wav", wav(), "audio/wav")}).status_code == 503
    assert client.get(base).json()["answered_count"] == 0
    client.post("/api/auth/logout")
    assert client.post(path, files={"file": ("answer.wav", wav(), "audio/wav")}).status_code == 401
