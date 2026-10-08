"""Scheduling and explicit application roles.
Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(10),
            sa.CheckConstraint("role IN ('user','admin')", name="role"),
            nullable=False,
            server_default="user",
        ),
    )
    op.create_table(
        "scheduled_interviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("role", sa.String(80), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("focus_areas", sa.JSON(), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("ai_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column(
            "interview_id",
            sa.Uuid(),
            sa.ForeignKey("interviews.id", ondelete="SET NULL"),
            unique=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('scheduled','cancelled','started')", name="status"),
        sa.CheckConstraint("question_count BETWEEN 1 AND 10", name="question_count"),
    )
    op.create_index("ix_scheduled_interviews_user_id", "scheduled_interviews", ["user_id"])
    op.create_index(
        "ix_scheduled_interviews_scheduled_at", "scheduled_interviews", ["scheduled_at"]
    )


def downgrade():
    op.drop_table("scheduled_interviews")
    op.drop_column("users", "role")
