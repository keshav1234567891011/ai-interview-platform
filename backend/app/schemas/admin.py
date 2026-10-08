from pydantic import BaseModel, ConfigDict, Field, field_validator


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    is_active: bool | None = None

    @field_validator("display_name")
    @classmethod
    def trim(cls, value):
        if value is not None:
            value = value.strip()
            if len(value) < 2:
                raise ValueError("Use at least two characters")
        return value
