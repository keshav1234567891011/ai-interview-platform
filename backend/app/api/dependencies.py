from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import COOKIE_NAME, decode_token
from app.db.session import get_session
from app.models.user import User

DbSession = Annotated[Session, Depends(get_session)]


def get_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    token = (
        authorization[7:]
        if authorization.startswith("Bearer ")
        else request.cookies.get(COOKIE_NAME)
    )
    if not token or len(token) > 4096:
        raise HTTPException(
            401, "Please sign in to continue.", headers={"WWW-Authenticate": "Bearer"}
        )
    return token


def get_authenticated_user(token: Annotated[str, Depends(get_token)], db: DbSession) -> User:
    claims = decode_token(token)
    try:
        user_id = UUID(claims["sub"])
    except (ValueError, TypeError):
        raise HTTPException(401, "Invalid session") from None
    user = db.get(User, user_id)
    if user is None or not user.is_active or user.token_version != claims["ver"]:
        raise HTTPException(401, "Session expired or invalid. Please sign in again.")
    return user


AuthenticatedUser = Annotated[User, Depends(get_authenticated_user)]


def get_current_user(user: AuthenticatedUser) -> User:
    if user.password_change_required:
        raise HTTPException(403, "Change your temporary password before continuing.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_admin(user: CurrentUser) -> User:
    if user.role not in {"admin", "owner"}:
        raise HTTPException(403, "Administrator access is required")
    return user


CurrentAdmin = Annotated[User, Depends(get_current_admin)]


def get_current_owner(user: CurrentUser) -> User:
    if user.role != "owner":
        raise HTTPException(403, "Owner access is required")
    return user


CurrentOwner = Annotated[User, Depends(get_current_owner)]


def require_permission(*permissions: str):
    from app.core.permissions import has_permission

    def check(user: CurrentAdmin) -> User:
        if not any(has_permission(user, permission) for permission in permissions):
            raise HTTPException(403, "This action requires an assigned permission")
        return user

    return check
