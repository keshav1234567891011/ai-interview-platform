"""In-memory owner acceptance server; never reads backend/.env or real database credentials."""

import json
import logging
import os
import secrets
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    logging.disable(logging.CRITICAL)
    import uvicorn
    from app.core.config import Settings, get_settings
    from cryptography.fernet import Fernet
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from sqlalchemy.pool import StaticPool

    payload = json.loads(sys.stdin.readline())
    if payload.get("email") != "isolated-owner@example.com":
        raise ValueError("Synthetic owner identity required")
    Settings.model_config["env_file"] = None
    os.environ["APP_ENV"] = "test"
    os.environ["OPENAI_API_KEY"] = ""
    os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)
    os.environ["SETTINGS_ENCRYPTION_KEY"] = Fernet.generate_key().decode()
    get_settings.cache_clear()
    from app.api import owner
    from app.core.security import password_hash
    from app.db.base import Base
    from app.db.session import get_session
    from app.main import create_app
    from app.models.user import User

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(
            User(
                email=payload["email"],
                display_name="Isolated Acceptance Owner",
                role="owner",
                password_change_required=False,
                hashed_password=password_hash.hash(payload["password"]),
            )
        )
        db.commit()
    application = create_app()

    def sessions():
        with Session(engine) as db:
            yield db

    application.dependency_overrides[get_session] = sessions
    owner.test_connection = lambda settings: (
        "connected"
    )  # Metadata transport is deliberately mocked.
    server = uvicorn.Server(
        uvicorn.Config(
            application, host="127.0.0.1", port=0, log_level="critical", access_log=False
        )
    )
    worker = threading.Thread(target=server.run, daemon=True)
    worker.start()
    for _ in range(100):
        if server.started:
            break
        if not worker.is_alive():
            raise RuntimeError("Isolated startup failed")
        time.sleep(0.05)
    if not server.started:
        raise RuntimeError("Isolated startup timed out")
    port = server.servers[0].sockets[0].getsockname()[1]
    print(json.dumps({"port": port}), flush=True)
    sys.stdin.readline()  # Closing stdin or sending a second line stops only this test server.
    server.should_exit = True
    worker.join(timeout=5)
    engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except BaseException:
        print(
            "Isolated owner acceptance server stopped; private details suppressed.", file=sys.stderr
        )
        sys.exit(1)
