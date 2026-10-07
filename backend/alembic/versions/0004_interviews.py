"""Persist interview sessions, ordered questions, and recoverable answers."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "interviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("role", sa.String(80), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("focus_areas", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('created','in_progress','completed','abandoned')", name="status"
        ),
        sa.CheckConstraint("question_count BETWEEN 1 AND 10", name="question_count"),
    )
    op.create_index("ix_interviews_user_id", "interviews", ["user_id"])
    op.create_table(
        "interview_questions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "interview_id",
            sa.Uuid(),
            sa.ForeignKey("interviews.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.UniqueConstraint("interview_id", "sequence", name="uq_interview_questions_interview_id"),
        sa.CheckConstraint("sequence > 0", name="sequence"),
    )
    op.create_index("ix_interview_questions_interview_id", "interview_questions", ["interview_id"])
    op.create_table(
        "interview_answers",
        sa.Column(
            "question_id",
            sa.Uuid(),
            sa.ForeignKey("interview_questions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    op.drop_table("interview_answers")
    op.drop_table("interview_questions")
    op.drop_table("interviews")
