"""Private resumes and deterministic job skill analysis."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "resumes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("original_filename", sa.String(180), nullable=False),
        sa.Column("storage_key", sa.String(50), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("storage_key", name="uq_resumes_storage_key"),
    )
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"])
    op.create_table(
        "resume_skills",
        sa.Column(
            "resume_id",
            sa.Uuid(),
            sa.ForeignKey("resumes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("skill_id", sa.String(40), sa.ForeignKey("skills.id"), primary_key=True),
    )
    op.create_table(
        "job_analyses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("role_keywords", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_job_analyses_user_id", "job_analyses", ["user_id"])
    op.create_table(
        "job_skills",
        sa.Column(
            "job_id",
            sa.Uuid(),
            sa.ForeignKey("job_analyses.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("skill_id", sa.String(40), sa.ForeignKey("skills.id"), primary_key=True),
        sa.Column("requirement", sa.String(20), nullable=False),
    )


def downgrade():
    op.drop_table("job_skills")
    op.drop_table("job_analyses")
    op.drop_table("resume_skills")
    op.drop_table("resumes")
