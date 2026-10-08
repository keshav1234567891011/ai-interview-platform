"""Atomic PostgreSQL quotas shared by workers; SQLite supports isolated tests.

Reserve BEFORE acquiring business-row locks or changing data. A reservation commits
independently of a failed password/provider call and never commits business mutations.
"""

import hashlib
import hmac
import secrets
import time

from fastapi import HTTPException, Request
from sqlalchemy import case, delete, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import signing_key
from app.models.rate_limit import RateLimitBucket


def bucket_key(scope: str, identity: str, seconds: int) -> str:
    return hmac.new(
        signing_key().encode(), f"{scope}:{seconds}:{identity}".encode(), hashlib.sha256
    ).hexdigest()


def reserve(db: Session, scope: str, identity: str, limit: int, seconds: int, *, now=None) -> None:
    timestamp = int(time.time() if now is None else now)
    window = timestamp // seconds * seconds
    fingerprint = bucket_key(scope, identity, seconds)
    table = RateLimitBucket.__table__
    dialect = db.get_bind().dialect.name
    insert = pg_insert if dialect == "postgresql" else sqlite_insert
    statement = insert(table).values(key=fingerprint, window_start=window, count=1)
    statement = statement.on_conflict_do_update(
        index_elements=[table.c.key],
        set_={
            "window_start": case(
                (table.c.window_start < window, window), else_=table.c.window_start
            ),
            "count": case((table.c.window_start < window, 1), else_=table.c.count + 1),
        },
        where=or_(table.c.window_start < window, table.c.count < limit),
    ).returning(table.c.count)
    allowed = db.scalar(statement) is not None
    # Bounded retention: stale pseudonymous identities are swept approximately every 100 requests.
    if secrets.randbelow(100) == 0:
        db.execute(delete(table).where(table.c.window_start < timestamp - 172800))
    db.commit()
    if not allowed:
        raise HTTPException(
            429,
            "Request limit reached. Please try again later.",
            headers={"Retry-After": str(max(1, window + seconds - timestamp))},
        )


def auth_budget(db: Session, request: Request, email: str, *, registering=False) -> None:
    if get_settings().app_env == "test":
        return
    identity = request.client.host if request.client else "unknown"
    reserve(db, "auth-ip", identity, 40, 60)
    reserve(
        db,
        "register-ip" if registering else "login-email",
        identity if registering else email,
        10,
        600 if registering else 60,
    )


def processing_budget(db: Session, user_id, *, audio=False) -> None:
    if get_settings().app_env == "test":
        return
    scope = "transcription" if audio else "interview-processing"
    reserve(db, scope, str(user_id), 6 if audio else 30, 60)
    reserve(db, scope, str(user_id), 100 if audio else 300, 86400)
