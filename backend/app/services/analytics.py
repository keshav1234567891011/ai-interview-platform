"""Real evaluation aggregates: session means are weighted equally, topics by answers."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.interview import AnswerEvaluation, Interview, InterviewQuestion
from app.services.evaluation import aggregate
from app.services.interviews import session_response, summary


def history_item(interview: Interview) -> dict:
    result = aggregate(interview) if interview.status == "completed" else None
    return {
        **summary(interview).model_dump(),
        "duration_seconds": session_response(interview).duration_seconds,
        "score": result["score"] if result else None,
        "technical_score": result["technical_score"] if result else None,
        "communication_score": result["communication_score"] if result else None,
    }


def analytics_data(db: Session, user_id) -> dict:
    keys = ("score", "technical_score", "reasoning_score", "communication_score")
    query = (
        select(
            Interview.id,
            Interview.role,
            Interview.completed_at,
            *[func.avg(getattr(AnswerEvaluation, key)).label(key) for key in keys],
        )
        .join(InterviewQuestion, InterviewQuestion.interview_id == Interview.id)
        .join(AnswerEvaluation, AnswerEvaluation.question_id == InterviewQuestion.id)
        .where(Interview.user_id == user_id, Interview.status == "completed")
        .group_by(Interview.id, Interview.role, Interview.completed_at)
        .order_by(Interview.completed_at)
    )
    rows = db.execute(query).mappings().all()
    total = db.scalar(
        select(func.count())
        .select_from(Interview)
        .where(Interview.user_id == user_id, Interview.status == "completed")
    )
    means = {
        key: round(sum(row[key] for row in rows) / len(rows)) if rows else None for key in keys
    }
    topics = (
        db.execute(
            select(
                InterviewQuestion.category.label("topic"),
                func.avg(AnswerEvaluation.score).label("score"),
                func.count().label("observations"),
            )
            .join(Interview, Interview.id == InterviewQuestion.interview_id)
            .join(AnswerEvaluation, AnswerEvaluation.question_id == InterviewQuestion.id)
            .where(Interview.user_id == user_id, Interview.status == "completed")
            .group_by(InterviewQuestion.category)
        )
        .mappings()
        .all()
    )
    ranked = sorted(
        [
            {
                "topic": row["topic"],
                "score": round(row["score"]),
                "observations": row["observations"],
            }
            for row in topics
        ],
        key=lambda row: row["score"],
    )
    insights = []
    if len(rows) >= 3:
        difference = round(rows[-1]["communication_score"] - rows[-3]["communication_score"])
        insights.append(
            f"Communication {'increased' if difference >= 0 else 'decreased'} "
            f"by {abs(difference)} points from the first to the last "
            "of your latest three evaluated interviews."
        )
    repeated = [topic for topic in ranked if topic["observations"] >= 3]
    if repeated:
        insights.append(
            f"{repeated[0]['topic'].replace('-', ' ').upper()} is the lowest scoring topic "
            "with at least three evaluated answers."
        )
    return {
        "completed_interviews": total,
        "evaluated_interviews": len(rows),
        "averages": means,
        "latest_score": round(rows[-1]["score"]) if rows else None,
        "best_score": round(max(row["score"] for row in rows)) if rows else None,
        "trend": [
            {
                "id": str(row["id"]),
                "role": row["role"],
                "date": row["completed_at"],
                **{key: round(row[key]) for key in keys},
            }
            for row in rows[-50:]
        ],
        "topics": ranked,
        "strongest_topics": ranked[-3:][::-1],
        "weakest_topics": ranked[:3],
        "insights": insights,
    }
