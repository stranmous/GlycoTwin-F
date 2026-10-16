"""M4 API schemas. Language is bilingual per the report (FE: en/ur switch)."""
import re
from datetime import datetime

from typing import Any

from pydantic import BaseModel, Field, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    active_language: str = Field(default="en", pattern="^(en|ur)$")

    @field_validator("email")
    @classmethod
    def _email_shape(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email address")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    active_language: str
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    token_type: str = "bearer"


class ProfileIn(BaseModel):
    age: int | None = Field(default=35, ge=1, le=120)
    weight_kg: float | None = Field(default=70.0, gt=0, le=500)
    height_cm: float | None = Field(default=170.0, gt=0, le=300)
    diabetes_type: str = Field(default="type2", min_length=1, max_length=50)
    activity_level: str = Field(default="moderate", min_length=1, max_length=50)
    medications: list[Any] = Field(default_factory=list)
    hba1c: float | None = Field(default=None, ge=3, le=20)
    display_name: str | None = None
    sex: str | None = None
    preferred_language: str | None = None


class ProfileOut(ProfileIn):
    user_id: str
    bmi: float
    display_name: str | None = None
    email: str | None = None

