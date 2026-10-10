from datetime import datetime
from typing import Literal
import uuid
from pydantic import BaseModel, ConfigDict


class MedicationIn(BaseModel):
    name: str
    dose: str | None = None
    schedule: str | None = None
    notes: str | None = None


class MedicationOut(MedicationIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class UserProfileIn(BaseModel):
    display_name: str | None = None
    age: int | None = None
    sex: Literal["male", "female", "other"] | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    diabetes_type: Literal["type1", "type2", "gestational", "prediabetes", "none"] | None = None
    timezone: str | None = None
    usual_meal_times: dict | None = None
    preferred_language: Literal["en", "ur"] | None = None
    medications: list[MedicationIn] | None = None
    consent_accepted: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    display_name: str | None = None
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    diabetes_type: str | None = None
    timezone: str | None = None
    preferred_language: str = "en"
    consent_accepted_at: datetime | None = None
    medications: list[MedicationOut] = []
