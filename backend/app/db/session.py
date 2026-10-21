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


def get_migration_database_url() -> str:
    direct = get_settings().migration_database_url
    return direct.get_secret_value() if direct else get_database_url()


@lru_cache
def get_engine() -> Engine:
    """Create the engine on demand; importing the app never connects to PostgreSQL."""
    return create_engine(
        get_database_url(),
        pool_pre_ping=True,
        echo=False,
        connect_args={"connect_timeout": 5, "prepare_threshold": None},
        pool_timeout=5,
        pool_size=get_settings().database_pool_size,
        max_overflow=get_settings().database_max_overflow,
        pool_recycle=300,
    )


def get_session() -> Iterator[Session]:
    """Session dependency for future routes; callers own their transaction commits."""
    with Session(get_engine()) as session:
        yield session
