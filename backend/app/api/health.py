import logging
import re
from functools import lru_cache
from threading import Lock
from time import monotonic

import anyio
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import TimeoutError as PoolTimeout

from app.core.config import BACKEND_ROOT
from app.core.security import signing_key
from app.db.session import get_engine
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])
# Use Uvicorn's configured handler, including when application access logs are disabled.
logger = logging.getLogger("uvicorn.error.readiness")
READINESS_TIMEOUT_SECONDS = 3.5  # Render requires the entire HTTP response within five seconds.
_probe_lock = Lock()


@router.get("/health", response_model=HealthResponse, summary="Application liveness")
def health() -> HealthResponse:
    """Report process health without requiring a database connection."""
    return HealthResponse(status="ok")


@lru_cache
def expected_revision() -> str:
    head = ScriptDirectory.from_config(Config(str(BACKEND_ROOT / "alembic.ini"))).get_current_head()
    if head is None:
        raise RuntimeError("No migration head")
    return head


class ReadinessFailure(Exception):
    """Internal, fixed reason codes; never include driver exception messages."""


def _failure_reason(exc: Exception, stage: str) -> tuple[str, str]:
    sqlstate = getattr(getattr(exc, "orig", exc), "sqlstate", None)
    # SQLSTATE is safe and useful (e.g. bad password vs. missing table). Nothing else
    # from the exception/driver diagnostics is logged: they can contain credentials.
    if not isinstance(sqlstate, str) or not re.fullmatch(r"[0-9A-Z]{5}", sqlstate):
        sqlstate = "none"
    if isinstance(exc, ReadinessFailure):
        reason = "migration_mismatch" if stage == "migration_version" else "query_failed"
    elif isinstance(exc, PoolTimeout):
        reason = "pool_timeout"
    elif sqlstate.startswith("28"):
        reason = "database_authentication"
    elif sqlstate == "57014":
        reason = "statement_timeout"
    elif sqlstate == "42P01" and stage == "migration_query":
        reason = "migration_table_missing"
    elif sqlstate == "3D000":
        reason = "database_missing"
    elif sqlstate.startswith("08"):
        reason = "database_connection_error"
    elif isinstance(exc, TimeoutError):
        reason = "timeout"
    elif stage == "database_connection":
        # libpq connection failures often have no SQLSTATE. Match fixed diagnostic
        # phrases in memory, but never emit their text, arguments or traceback.
        message = str(getattr(exc, "orig", exc)).casefold()
        reason = "database_connection_error"
        for phrase, code in (
            ("password authentication failed", "database_authentication"),
            ("no password supplied", "database_authentication"),
            ("could not translate host name", "dns_failure"),
            ("name or service not known", "dns_failure"),
            ("temporary failure in name resolution", "dns_failure"),
            ("connection refused", "connection_refused"),
            ("timeout expired", "connection_timeout"),
            ("connection timed out", "connection_timeout"),
            ("certificate verify failed", "tls_verification"),
            ("server does not support ssl", "tls_configuration"),
            ("invalid connection option", "driver_configuration"),
        ):
            if phrase in message:
                reason = code
                break
    else:
        reason = "check_failed"
    return reason, sqlstate


def _check_readiness(progress: dict) -> bool:
    # Abandoning a timed-out thread cannot stop a synchronous driver operation.
    # Keep at most one probe in flight so retries cannot exhaust threads/connections.
    if not _probe_lock.acquire(blocking=False):
        logger.warning("readiness_failed stage=probe_in_progress reason=probe_in_progress")
        return False
    started = monotonic()

    def stage(name):
        progress.update(stage=name, stage_started=monotonic())

    try:
        stage("jwt_configuration")
        signing_key()
        stage("migration_files")
        head = expected_revision()
        stage("database_configuration")
        engine = get_engine()
        stage("database_connection")
        with engine.connect() as connection:
            connect_ms = round((monotonic() - progress["stage_started"]) * 1000)
            stage("database_query_setup")
            if connection.dialect.name == "postgresql":
                connection.exec_driver_sql("SET TRANSACTION READ ONLY")
                connection.exec_driver_sql("SET LOCAL statement_timeout = '1000ms'")
            stage("database_query")
            if connection.scalar(text("SELECT 1")) != 1:
                raise ReadinessFailure()
            stage("migration_query")
            revisions = connection.scalars(text("SELECT version_num FROM alembic_version")).all()
            stage("migration_version")
            if revisions != [head]:
                raise ReadinessFailure()
            stage("database_cleanup")
        logger.info(
            "readiness_passed stage=complete connect_ms=%d elapsed_ms=%d",
            connect_ms,
            round((monotonic() - started) * 1000),
        )
        return True
    except Exception as exc:
        reason, sqlstate = _failure_reason(exc, progress["stage"])
        logger.warning(
            "readiness_failed stage=%s reason=%s sqlstate=%s elapsed_ms=%d",
            progress["stage"],
            reason,
            sqlstate,
            round((monotonic() - started) * 1000),
        )
        return False
    finally:
        _probe_lock.release()


@router.get("/ready", summary="Database and authentication readiness")
async def ready():
    progress = {"stage": "worker_queue", "stage_started": monotonic()}
    healthy = False
    # An HTTP deadline covers pool checkout, DNS/TLS, pre-ping and every SQL query.
    # A driver connect_timeout alone does not bound all these operations together.
    with anyio.move_on_after(READINESS_TIMEOUT_SECONDS) as scope:
        healthy = await anyio.to_thread.run_sync(_check_readiness, progress, abandon_on_cancel=True)
    if scope.cancel_called:
        logger.warning(
            "readiness_failed stage=%s reason=response_timeout stage_elapsed_ms=%d",
            progress["stage"],
            round((monotonic() - progress["stage_started"]) * 1000),
        )
    if not healthy or scope.cancel_called:
        raise HTTPException(503, "Service is not ready.")
    return {"status": "ready"}
