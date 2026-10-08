"""Validate migration/schema parity without a live database or application secrets."""

from io import StringIO
from unittest.mock import patch

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

from app import models  # noqa: F401
from app.core.config import BACKEND_ROOT
from app.db.base import Base


def validate() -> None:
    configuration = Config(str(BACKEND_ROOT / "alembic.ini"))
    engine = create_engine("sqlite://")
    try:
        with engine.begin() as connection:
            configuration.attributes["connection"] = connection
            command.upgrade(configuration, "head")
            assert not compare_metadata(MigrationContext.configure(connection), Base.metadata)
            command.downgrade(configuration, "base")
        offline = Config(str(BACKEND_ROOT / "alembic.ini"), output_buffer=StringIO())
        with patch(
            "app.db.session.get_database_url",
            return_value="postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME",
        ):
            command.upgrade(offline, "head", sql=True)
        assert "CREATE TABLE rate_limit_buckets" in offline.output_buffer.getvalue()
    finally:
        engine.dispose()


if __name__ == "__main__":
    validate()
    print("Migration upgrade/downgrade, metadata parity and PostgreSQL offline SQL passed.")
