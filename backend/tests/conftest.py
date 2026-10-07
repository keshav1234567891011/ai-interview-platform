import asyncio
import secrets

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_session
from app.main import create_app


class ApiClient:
    def __init__(self, application):
        self.application = application
        self.cookies = httpx.Cookies()

    def request(self, method, path, **kwargs):
        async def send():
            headers = {"X-InterviewAI-Request": "1", **kwargs.pop("headers", {})}
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=self.application),
                base_url="http://localhost",
                cookies=self.cookies,
            ) as client:
                response = await client.request(method, path, headers=headers, **kwargs)
                self.cookies = client.cookies
                return response

        return asyncio.run(send())

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)

    def put(self, path, **kwargs):
        return self.request("PUT", path, **kwargs)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("JWT_SECRET", secrets.token_urlsafe(48))
    get_settings.cache_clear()
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    from app.core.skills import SKILLS
    from app.models.profile import Skill

    with Session(engine) as db:
        db.add_all(Skill(id=id, name=name, category=category) for id, name, category in SKILLS)
        db.commit()
    application = create_app()

    def sessions():
        with Session(engine) as session:
            yield session

    application.dependency_overrides[get_session] = sessions
    result = ApiClient(application)
    result.engine = engine
    yield result
    engine.dispose()
    get_settings.cache_clear()


@pytest.fixture
def account(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "candidate@example.com",
            "display_name": "Test Candidate",
            "password": "Test-account-password42",
        },
    )
    assert response.status_code == 201
    return response.json()
