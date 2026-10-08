"""Single protected owner, delegated permissions and password lifecycle.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    # SQLite's old ADD COLUMN did not install the named role constraint.
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("users") as batch:
            batch.add_column(
                sa.Column(
                    "password_change_required", sa.Boolean(), nullable=False, server_default="false"
                )
            )
            batch.add_column(sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
            batch.create_check_constraint(op.f("ck_users_role"), "role IN ('user','admin','owner')")
            batch.create_check_constraint(
                op.f("ck_users_owner_active"), "role != 'owner' OR is_active"
            )
    else:
        op.drop_constraint(op.f("ck_users_role"), "users", type_="check")
        op.create_check_constraint(
            op.f("ck_users_role"), "users", "role IN ('user','admin','owner')"
        )
        op.create_check_constraint(
            op.f("ck_users_owner_active"), "users", "role != 'owner' OR is_active"
        )
        op.add_column(
            "users",
            sa.Column(
                "password_change_required", sa.Boolean(), nullable=False, server_default="false"
            ),
        )
        op.add_column(
            "users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True)
        )
    op.create_index(
        "uq_users_single_owner",
        "users",
        ["role"],
        unique=True,
        postgresql_where=sa.text("role = 'owner'"),
        sqlite_where=sa.text("role = 'owner'"),
    )
    op.create_table(
        "admin_permissions",
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("permission", sa.String(40), primary_key=True),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("target_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for field in ("actor_id", "target_id", "created_at"):
        op.create_index(f"ix_audit_events_{field}", "audit_events", [field])


def downgrade():
    # Preserve accounts; an explicit downgrade removes owner privileges, not users.
    op.execute("UPDATE users SET role = 'user' WHERE role = 'owner'")
    op.drop_table("audit_events")
    op.drop_table("admin_permissions")
    op.drop_index("uq_users_single_owner", table_name="users")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint(op.f("ck_users_owner_active"), type_="check")
        batch.drop_constraint(op.f("ck_users_role"), type_="check")
        if op.get_bind().dialect.name != "sqlite":
            batch.create_check_constraint(op.f("ck_users_role"), "role IN ('user','admin')")
        batch.drop_column("last_login_at")
        batch.drop_column("password_change_required")
