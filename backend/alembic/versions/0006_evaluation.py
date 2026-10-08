"""Persist evaluation and measured voice duration, never raw audio.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "interview_answers",
        sa.Column("input_mode", sa.String(10), nullable=False, server_default="text"),
    )
    op.add_column(
        "interview_answers", sa.Column("recording_duration_seconds", sa.Float(), nullable=True)
    )
    op.create_table(
        "answer_evaluations",
        sa.Column(
            "question_id",
            sa.Uuid(),
            sa.ForeignKey("interview_questions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("technical_score", sa.Integer(), nullable=False),
        sa.Column("reasoning_score", sa.Integer(), nullable=False),
        sa.Column("communication_score", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        *[
            sa.CheckConstraint(f"{column} BETWEEN 0 AND 100", name=column)
            for column in ("score", "technical_score", "reasoning_score", "communication_score")
        ],
    )


def downgrade():
    op.drop_table("answer_evaluations")
    op.drop_column("interview_answers", "recording_duration_seconds")
    op.drop_column("interview_answers", "input_mode")
