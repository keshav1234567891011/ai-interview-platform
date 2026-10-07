from collections.abc import Iterator
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


def get_database_url() -> str:
    url = get_settings().database_url
    if url is None:
        raise HTTPException(503, "Configure DATABASE_URL in backend/.env before using the database")
    return url.get_secret_value()


@lru_cache
def get_engine() -> Engine:
    """Create the engine on demand; importing the app never connects to PostgreSQL."""
    return create_engine(get_database_url(), pool_pre_ping=True, echo=False)


def get_session() -> Iterator[Session]:
    """Session dependency for future routes; callers own their transaction commits."""
    with Session(get_engine()) as session:
        yield session
