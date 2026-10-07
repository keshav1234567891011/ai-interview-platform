from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.security import COOKIE_NAME, create_token, dummy_hash, password_hash, signing_key
from app.models.user import User
from app.schemas.auth import Credentials, RegisterRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
attempts: dict[str, deque[float]] = defaultdict(deque)
attempt_lock = Lock()


def limit_attempts(request: Request) -> None:
    if get_settings().app_env == "test":
        return
    key = request.client.host if request.client else "unknown"
    now = monotonic()
    with attempt_lock:
        for stale in [k for k, v in attempts.items() if not v or now - v[-1] > 60]:
            del attempts[stale]
        queue = attempts[key]
        while queue and now - queue[0] > 60:
            queue.popleft()
        if len(queue) >= 10 or len(attempts) > 10000:
            raise HTTPException(
                429,
                "Too many attempts. Please try again in a minute.",
                headers={"Retry-After": "60"},
            )
        queue.append(now)


def attach_session(response: Response, user: User) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(user),
        httponly=True,
        secure=get_settings().app_env == "production",
        samesite="lax",
        path="/api",
        max_age=get_settings().access_token_expire_minutes * 60,
    )
    response.headers["Cache-Control"] = "no-store"


@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, response: Response, db: DbSession) -> User:
    limit_attempts(request)
    signing_key()
    user = User(
        email=str(payload.email),
        display_name=payload.display_name,
        hashed_password=password_hash.hash(payload.password.get_secret_value()),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.") from None
    db.refresh(user)
    attach_session(response, user)
    return user


@router.post("/login", response_model=UserResponse)
def login(payload: Credentials, request: Request, response: Response, db: DbSession) -> User:
    limit_attempts(request)
    signing_key()
    user = db.scalar(select(User).where(User.email == str(payload.email)))
    valid = password_hash.verify(
        payload.password.get_secret_value(), user.hashed_password if user else dummy_hash
    )
    if not user or not valid or not user.is_active:
        raise HTTPException(401, "Email or password is incorrect.")
    attach_session(response, user)
    return user


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser, response: Response) -> User:
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/logout", status_code=204)
def logout(user: CurrentUser, db: DbSession, response: Response) -> None:
    user.token_version += 1
    db.commit()
    response.delete_cookie(
        COOKIE_NAME,
        path="/api",
        secure=get_settings().app_env == "production",
        httponly=True,
        samesite="lax",
    )
