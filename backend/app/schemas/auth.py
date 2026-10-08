from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    field_validator,
    model_validator,
)


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: SecretStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().casefold() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def limit_password(cls, value: SecretStr) -> SecretStr:
        if not 1 <= len(value.get_secret_value()) <= 128:
            raise ValueError("Password must contain 1 to 128 characters")
        return value


class RegisterRequest(Credentials):
    display_name: str = Field(min_length=2, max_length=80)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Display name must contain at least 2 characters")
        return value

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if (
            len(password) < 10
            or not any(c.isalpha() for c in password)
            or not any(c.isdigit() for c in password)
        ):
            raise ValueError("Use at least 10 characters, including a letter and a number")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str
    is_active: bool
    role: Literal["user", "admin", "owner"]
    password_change_required: bool
    permissions: list[str]
    last_login_at: datetime | None
    created_at: datetime


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: SecretStr
    new_password: SecretStr
    confirm_password: SecretStr

    @field_validator("current_password", "new_password", "confirm_password")
    @classmethod
    def bounded(cls, value):
        return Credentials.limit_password(value)

    @field_validator("new_password")
    @classmethod
    def strong(cls, value):
        return RegisterRequest.strong_password(value)

    @model_validator(mode="after")
    def matching(self):
        if self.new_password.get_secret_value() != self.confirm_password.get_secret_value():
            raise ValueError("New password and confirmation must match")
        return self
