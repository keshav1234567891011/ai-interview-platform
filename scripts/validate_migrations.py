"""Compile PostgreSQL migrations offline using placeholders only."""
import os
from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config

os.environ["DATABASE_URL"] = "postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME"
configuration = Config(str(Path(__file__).resolve().parents[1] / "backend" / "alembic.ini"), output_buffer=StringIO())
command.upgrade(configuration, "head", sql=True)
assert "CREATE TABLE users" in configuration.output_buffer.getvalue()
print("PostgreSQL migrations compile offline. No live database connection was made.")
