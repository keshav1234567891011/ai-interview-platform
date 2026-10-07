"""Normalized candidate profiles and canonical skills."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SEED_SKILLS = [
    ("java", "Java", "language"),
    ("python", "Python", "language"),
    ("javascript", "JavaScript", "language"),
    ("typescript", "TypeScript", "language"),
    ("react", "React", "framework"),
    ("nodejs", "Node.js", "framework"),
    ("fastapi", "FastAPI", "framework"),
    ("spring-boot", "Spring Boot", "framework"),
    ("sql", "SQL", "database"),
    ("postgresql", "PostgreSQL", "database"),
    ("docker", "Docker", "tool"),
    ("aws", "AWS", "tool"),
    ("dbms", "DBMS", "cs"),
    ("operating-systems", "Operating Systems", "cs"),
    ("computer-networks", "Computer Networks", "cs"),
    ("system-design", "System Design", "cs"),
    ("dsa", "Data Structures & Algorithms", "cs"),
    ("oop", "Object-Oriented Programming", "cs"),
]


def upgrade():
    table = op.create_table(
        "skills",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.UniqueConstraint("name", name="uq_skills_name"),
    )
    op.bulk_insert(
        table,
        [{"id": id, "name": name, "category": category} for id, name, category in SEED_SKILLS],
    )
    op.create_table(
        "user_profiles",
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("target_role", sa.String(80), nullable=False),
        sa.Column("experience_level", sa.String(24), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "profile_skills",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("user_profiles.user_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("skill_id", sa.String(40), sa.ForeignKey("skills.id"), primary_key=True),
    )


def downgrade():
    op.drop_table("profile_skills")
    op.drop_table("user_profiles")
    op.drop_table("skills")
