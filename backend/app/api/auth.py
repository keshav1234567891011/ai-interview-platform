from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import AuthenticatedUser, DbSession
from app.core.config import get_settings
from app.core.rate_limit import auth_budget, reserve
from app.core.security import COOKIE_NAME, create_token, dummy_hash, password_hash, signing_key
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, Credentials, RegisterRequest, UserResponse
from app.services.administration import audit, lock_user

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
    user = db.scalar(select(User).where(User.email == str(payload.email)).with_for_update())
    valid = password_hash.verify(
        payload.password.get_secret_value(), user.hashed_password if user else dummy_hash
    )
    if not user or not valid or not user.is_active:
        raise HTTPException(401, "Email or password is incorrect.")
    user.last_login_at = datetime.now(UTC)
    db.commit()
    attach_session(response, user)
    return user


@router.get("/me", response_model=UserResponse)
def me(user: AuthenticatedUser, response: Response) -> User:
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/logout", status_code=204)
def logout(user: AuthenticatedUser, db: DbSession, response: Response) -> None:
    locked = lock_user(db, user.id)
    locked.token_version += 1
    db.commit()
    response.delete_cookie(
        COOKIE_NAME,
        path="/api",
        secure=get_settings().app_env == "production",
        httponly=True,
        samesite="lax",
    )


@router.post("/change-password", response_model=UserResponse)
def change_password(
    payload: ChangePasswordRequest, user: AuthenticatedUser, db: DbSession, response: Response
):
    version = user.token_version
    if get_settings().app_env != "test":
        reserve(db, "password-change", str(user.id), 5, 600)
    user = lock_user(db, user.id)
    if not user.is_active or user.token_version != version:
        raise HTTPException(401, "Session expired. Please sign in again.")
    current = payload.current_password.get_secret_value()
    new = payload.new_password.get_secret_value()
    if not password_hash.verify(current, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect.")
    if password_hash.verify(new, user.hashed_password):
        raise HTTPException(422, "Choose a password different from your current password.")
    user.hashed_password = password_hash.hash(new)
    user.password_change_required = False
    user.token_version += 1
    audit(db, user, user, f"{user.role}_password_changed")
    db.commit()
    attach_session(response, user)
    return user
