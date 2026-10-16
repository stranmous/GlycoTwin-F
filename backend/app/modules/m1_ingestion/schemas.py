from datetime import UTC, datetime

from pydantic import BaseModel, Field


class CGMReadingPayload(BaseModel):
    timestamp: datetime
    glucose_mg_dl: float = Field(
        ...,
        ge=20.0,
        le=600.0,
        description="Interstitial glucose concentration in mg/dL (physiological limits: 20-600 mg/dL)",
    )
    source: str = Field(default="cgm_sensor", min_length=1)
    trend: str | None = None


class MealRecordPayload(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    carbohydrates_g: float = Field(default=0.0, ge=0.0, description="Carbohydrate content in grams (>= 0)")
    protein_g: float = Field(default=0.0, ge=0.0, description="Protein content in grams (>= 0)")
    fat_g: float = Field(default=0.0, ge=0.0, description="Fat content in grams (>= 0)")
    fiber_g: float = Field(default=0.0, ge=0.0, description="Fiber content in grams (>= 0)")
    glycemic_index: float | None = Field(default=None, ge=0.0, le=100.0, description="Glycemic index (0-100)")
    meal_type: str = Field(default="snack", description="Meal type: breakfast, lunch, dinner, snack")
    name: str | None = None
    dish_label: str | None = None
    carbs_g: float | None = None
    total_carbs_g: float | None = None
    detected_foods: list[dict] | None = None
    image_url: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "MealRecordPayload":
        d = dict(data)
        if "name" not in d and "dish_label" in d:
            d["name"] = d["dish_label"]
        elif "dish_label" not in d and "name" in d:
            d["dish_label"] = d["name"]
        if "carbohydrates_g" not in d:
            if "total_carbs_g" in d:
                d["carbohydrates_g"] = d["total_carbs_g"]
            elif "carbs_g" in d:
                d["carbohydrates_g"] = d["carbs_g"]
        if "timestamp" not in d:
            if "eaten_at" in d:
                d["timestamp"] = d["eaten_at"]
            elif "logged_at" in d:
                d["timestamp"] = d["logged_at"]
            else:
                d["timestamp"] = datetime.now(UTC)
        return cls(**d)


class UserProfilePayload(BaseModel):
    user_id: str = Field(..., min_length=1)
    age: int | None = Field(default=None, ge=1, le=120)
    bmi: float | None = Field(default=None, ge=10.0, le=70.0)
    diabetic_type: str = Field(default="type_2", description="Metabolic phenotype / diabetic classification")
    baseline_insulin_sensitivity: float | None = Field(default=None, ge=0.0)


class InsulinDosePayload(BaseModel):
    """One exogenous insulin dose event (T1D patients inject; the ODE's
    endogenous term alone misrepresents them)."""
    timestamp: datetime
    units: float = Field(..., ge=0.0, description="Insulin units delivered")
    kind: str = Field(default="bolus", description="bolus | basal | fast | slow")


class IngestedUserData(BaseModel):
    user_id: str = Field(..., min_length=1)
    user_profile: UserProfilePayload | None = None
    cgm_readings: list[CGMReadingPayload] = Field(default_factory=list)
    meal_records: list[MealRecordPayload] = Field(default_factory=list)
    insulin_doses: list[InsulinDosePayload] = Field(default_factory=list)
    activity_minutes: float | None = Field(default=None, ge=0.0)
    sleep_hours: float | None = Field(default=None, ge=0.0, le=24.0)
    ingested_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
