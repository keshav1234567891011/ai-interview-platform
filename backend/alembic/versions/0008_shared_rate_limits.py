"""Shared, privacy-preserving request quotas.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_buckets",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("window_start", sa.Integer(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.CheckConstraint("count >= 1", name="ck_rate_limit_positive"),
    )
    op.create_index("ix_rate_limit_buckets_window_start", "rate_limit_buckets", ["window_start"])


def downgrade() -> None:
    op.drop_index("ix_rate_limit_buckets_window_start", table_name="rate_limit_buckets")
    op.drop_table("rate_limit_buckets")
