from functools import lru_cache

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.core.config import BACKEND_ROOT
from app.core.security import signing_key
from app.db.session import get_engine
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Application liveness")
def health() -> HealthResponse:
    """Report process health without requiring a database connection."""
    return HealthResponse(status="ok")


@lru_cache
def expected_revision() -> str:
    return ScriptDirectory.from_config(Config(str(BACKEND_ROOT / "alembic.ini"))).get_current_head()


@router.get("/ready", summary="Database and authentication readiness")
def ready():
    try:
        signing_key()
        with get_engine().connect() as connection:
            if connection.dialect.name == "postgresql":
                connection.exec_driver_sql("SET LOCAL statement_timeout = '5s'")
            assert connection.scalar(text("SELECT 1")) == 1
            revisions = connection.scalars(text("SELECT version_num FROM alembic_version")).all()
            if revisions != [expected_revision()]:
                raise ValueError("Pending migrations")
    except Exception:
        # Infrastructure diagnostics belong in controlled operations, never public responses.
        raise HTTPException(503, "Service is not ready.") from None
    return {"status": "ready"}
