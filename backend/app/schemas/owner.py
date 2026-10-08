from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator

from app.core.permissions import PERMISSIONS
from app.schemas.auth import RegisterRequest


class PermissionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permissions: list[str] = Field(max_length=len(PERMISSIONS))

    @field_validator("permissions")
    @classmethod
    def known(cls, values):
        if not set(values) <= PERMISSIONS.keys() or len(values) != len(set(values)):
            raise ValueError("Choose unique permissions from the supported list")
        return values


class TemporaryPassword(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: SecretStr
    confirm_password: SecretStr

    @field_validator("password", "confirm_password")
    @classmethod
    def strong(cls, value):
        if len(value.get_secret_value()) > 128:
            raise ValueError("Password must contain at most 128 characters")
        return RegisterRequest.strong_password(value)

    @model_validator(mode="after")
    def matching(self):
        if self.password.get_secret_value() != self.confirm_password.get_secret_value():
            raise ValueError("Temporary password and confirmation must match")
        return self


class AdminCreate(RegisterRequest, PermissionUpdate, TemporaryPassword):
    existing_user_id: UUID | None = None


class AdminState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool
