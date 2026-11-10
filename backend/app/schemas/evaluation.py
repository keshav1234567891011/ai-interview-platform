from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

FeedbackItem = Annotated[str, Field(min_length=1, max_length=500)]


class RubricEvaluation(BaseModel):
    """Concise feedback only; no private model reasoning is accepted or persisted."""

    model_config = ConfigDict(extra="forbid", strict=True)
    technical_score: int = Field(ge=0, le=100)
    coverage_score: int = Field(ge=0, le=100)
    reasoning_score: int = Field(ge=0, le=100)
    practical_score: int = Field(ge=0, le=100)
    communication_score: int = Field(ge=0, le=100)
    strengths: list[FeedbackItem] = Field(max_length=6)
    weaknesses: list[FeedbackItem] = Field(max_length=6)
    concepts_covered: list[FeedbackItem] = Field(default_factory=list, max_length=12)
    concepts_missed: list[FeedbackItem] = Field(max_length=12)
    feedback: str = Field(min_length=10, max_length=1500)
    improvement_suggestion: str = Field(min_length=10, max_length=1500)
    sample_answer: str = Field(min_length=10, max_length=2000)


class CommunicationSignals(BaseModel):
    word_count: int
    sentence_count: int
    filler_count: int
    fillers_per_100_words: float
    frequent_fillers: dict[str, int]
    duration_seconds: float | None
    words_per_minute: float | None
    pace: str | None
    recommendations: list[str]


class EvaluationResponse(RubricEvaluation):
    score: int = Field(ge=0, le=100)
    source: Literal["deterministic", "ai"]
    fallback_reason: str | None = None
    provider_model: str | None = None
    communication: CommunicationSignals
