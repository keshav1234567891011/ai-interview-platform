from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

from app.db.base import Base


def test_migration_roundtrip_and_metadata():
    configuration = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        configuration.attributes["connection"] = connection
        command.upgrade(configuration, "head")
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
        command.downgrade(configuration, "base")
    engine.dispose()
