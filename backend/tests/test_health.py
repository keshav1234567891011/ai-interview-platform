import asyncio
import logging
import time
from threading import Event
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeout

from app.api import health
from app.core.config import get_settings

PRIVATE = "PRIVATE_PASSWORD_DATABASE_URL_AND_DRIVER_MESSAGE"


class ProbeConnection:
    dialect = SimpleNamespace(name="postgresql")

    def __init__(self):
        self.queries = []
        self.revisions = ["0010"]
        self.fail_query = None
        self.failure = None
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True

    def execute(self, query):
        query = str(query)
        self.queries.append(query)
        if query == self.fail_query:
            raise self.failure

    def exec_driver_sql(self, query):
        self.execute(query)

    def scalar(self, query):
        self.execute(query)
        return 1

    def scalars(self, query):
        self.execute(query)
        return SimpleNamespace(all=lambda: self.revisions)


@pytest.fixture
def connection(client, monkeypatch):
    connection = ProbeConnection()
    monkeypatch.setattr(health, "get_engine", lambda: SimpleNamespace(connect=lambda: connection))
    monkeypatch.setattr(health, "expected_revision", lambda: "0010")
    return connection


def driver_failure(sqlstate):
    error = RuntimeError(PRIVATE)
    error.sqlstate = sqlstate
    return OperationalError("PRIVATE_SQL", {"password": PRIVATE}, error)


def test_ready_checks_read_only_database_and_logs_safe_timings(client, connection, caplog):
    with caplog.at_level(logging.INFO, logger=health.logger.name):
        response = client.get("/ready")
    assert response.json() == {"status": "ready"}
    assert connection.queries == [
        "SET TRANSACTION READ ONLY",
        "SET LOCAL statement_timeout = '1000ms'",
        "SELECT 1",
        "SELECT version_num FROM alembic_version",
    ]
    assert connection.closed
    assert "readiness_passed" in caplog.text and "connect_ms=" in caplog.text


@pytest.mark.parametrize("jwt_value", ["", "short", "REPLACE_" + "x" * 40])
def test_ready_rejects_missing_or_invalid_jwt_without_touching_database(
    client, connection, monkeypatch, caplog, jwt_value
):
    monkeypatch.setenv("JWT_SECRET", jwt_value)
    get_settings.cache_clear()
    assert client.get("/ready").status_code == 503
    assert connection.queries == []
    assert "stage=jwt_configuration" in caplog.text
    assert "Authentication is not configured" not in caplog.text


@pytest.mark.parametrize("stage", ["migration_files", "database_configuration"])
def test_ready_reports_local_configuration_failures_safely(
    client, connection, monkeypatch, caplog, stage
):
    def unavailable():
        raise RuntimeError(PRIVATE)

    monkeypatch.setattr(
        health, "expected_revision" if stage == "migration_files" else "get_engine", unavailable
    )
    response = client.get("/ready")
    assert response.status_code == 503
    assert f"stage={stage}" in caplog.text
    assert PRIVATE not in response.text + caplog.text
    assert not connection.queries


@pytest.mark.parametrize(
    ("failure", "reason", "sqlstate"),
    [
        (driver_failure("28P01"), "database_authentication", "28P01"),
        (driver_failure("3D000"), "database_missing", "3D000"),
        (driver_failure("08006"), "database_connection_error", "08006"),
        (driver_failure(PRIVATE), "database_connection_error", "none"),
        (PoolTimeout(PRIVATE), "pool_timeout", "none"),
        (TimeoutError(PRIVATE), "timeout", "none"),
    ],
)
def test_ready_reports_connection_failure_and_recovery(
    client, connection, monkeypatch, caplog, failure, reason, sqlstate
):
    def unavailable():
        raise failure

    monkeypatch.setattr(health, "get_engine", lambda: SimpleNamespace(connect=unavailable))
    response = client.get("/ready")
    assert response.status_code == 503
    assert "stage=database_connection" in caplog.text
    assert f"reason={reason} sqlstate={sqlstate}" in caplog.text
    assert PRIVATE not in response.text + caplog.text
    monkeypatch.setattr(health, "get_engine", lambda: SimpleNamespace(connect=lambda: connection))
    assert client.get("/ready").status_code == 200


@pytest.mark.parametrize(
    ("message", "reason"),
    [
        ("password authentication failed", "database_authentication"),
        ("could not translate host name", "dns_failure"),
        ("connection refused", "connection_refused"),
        ("connection timed out", "connection_timeout"),
        ("certificate verify failed", "tls_verification"),
        ("server does not support SSL", "tls_configuration"),
        ("invalid connection option", "driver_configuration"),
    ],
)
def test_ready_classifies_libpq_failures_without_logging_messages(
    client, connection, monkeypatch, caplog, message, reason
):
    def unavailable():
        raise OperationalError("PRIVATE_SQL", {}, RuntimeError(message + " " + PRIVATE))

    monkeypatch.setattr(health, "get_engine", lambda: SimpleNamespace(connect=unavailable))
    response = client.get("/ready")
    assert response.status_code == 503
    assert f"stage=database_connection reason={reason} sqlstate=none" in caplog.text
    assert PRIVATE not in response.text + caplog.text
    assert message not in response.text + caplog.text


@pytest.mark.parametrize(
    ("query", "failure", "stage", "reason"),
    [
        (
            "SET TRANSACTION READ ONLY",
            driver_failure("08006"),
            "database_query_setup",
            "database_connection_error",
        ),
        ("SELECT 1", driver_failure("57014"), "database_query", "statement_timeout"),
        (
            "SELECT version_num FROM alembic_version",
            driver_failure("42P01"),
            "migration_query",
            "migration_table_missing",
        ),
    ],
)
def test_ready_reports_query_and_migration_failures(
    client, connection, caplog, query, failure, stage, reason
):
    connection.fail_query = query
    connection.failure = failure
    response = client.get("/ready")
    assert response.status_code == 503
    assert f"stage={stage} reason={reason}" in caplog.text
    assert PRIVATE not in response.text + caplog.text
    assert connection.closed


@pytest.mark.parametrize("revisions", [[], ["0009"], ["0010", "0009"]])
def test_ready_rejects_incorrect_migration_versions(client, connection, caplog, revisions):
    connection.revisions = revisions
    assert client.get("/ready").status_code == 503
    assert "stage=migration_version reason=migration_mismatch" in caplog.text


@pytest.mark.parametrize("blocked_stage", ["database_connection", "database_query"])
def test_ready_deadline_does_not_pile_up_probes_and_recovers(
    client, connection, monkeypatch, caplog, blocked_stage
):
    release = Event()
    attempts = []

    def delay():
        attempts.append(1)
        assert release.wait(5)

    if blocked_stage == "database_connection":

        def delayed_connect():
            delay()
            return connection

        monkeypatch.setattr(health, "get_engine", lambda: SimpleNamespace(connect=delayed_connect))
    else:
        original_scalar = connection.scalar

        def delayed_query(query):
            delay()
            return original_scalar(query)

        monkeypatch.setattr(connection, "scalar", delayed_query)

    monkeypatch.setattr(health, "READINESS_TIMEOUT_SECONDS", 0.05)

    async def exercise():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=client.application), base_url="http://test"
        ) as http:
            started = time.monotonic()
            first = await http.get("/ready")
            assert first.status_code == 503
            assert time.monotonic() - started < 1
            assert f"stage={blocked_stage} reason=response_timeout" in caplog.text
            # A timed-out driver operation keeps running; repeated HTTP probes must
            # neither launch more database calls nor block the liveness endpoint.
            for _ in range(3):
                assert (await http.get("/ready")).status_code == 503
            assert (await http.get("/health")).status_code == 200
            assert len(attempts) == 1
            release.set()
            for _ in range(100):
                if not health._probe_lock.locked():
                    break
                await asyncio.sleep(0.01)
            assert not health._probe_lock.locked()
            assert (await http.get("/ready")).status_code == 200

    try:
        asyncio.run(exercise())
    finally:
        release.set()
        # Do not leave a worker holding the global probe lock for other tests.
        for _ in range(100):
            if not health._probe_lock.locked():
                break
            time.sleep(0.01)
    assert PRIVATE not in caplog.text


def test_ready_keeps_generic_public_error(client, connection, monkeypatch, caplog):
    def unavailable():
        raise HTTPException(503, PRIVATE)

    monkeypatch.setattr(health, "signing_key", unavailable)
    response = client.get("/ready")
    assert response.json() == {"detail": "Service is not ready."}
    assert PRIVATE not in response.text + caplog.text


def test_readiness_deadline_leaves_render_response_margin():
    assert 0 < health.READINESS_TIMEOUT_SECONDS < 4
