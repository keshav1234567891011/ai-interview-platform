from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.rate_limit import auth_budget
from app.core.security import COOKIE_NAME, create_token, dummy_hash, password_hash, signing_key
from app.models.user import User
from app.schemas.auth import Credentials, RegisterRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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
    auth_budget(db, request, str(payload.email), registering=True)
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
    auth_budget(db, request, str(payload.email))
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
