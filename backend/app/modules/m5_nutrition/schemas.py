"""M5 API schemas. Nutrition values come from the Decimal calculator; floats
here are presentation-only, converted at the boundary."""
from pydantic import BaseModel, Field


class StageRecordOut(BaseModel):
    name: str
    adapter: str
    succeeded: bool
    failure_code: str | None = None
    elapsed_ms: float | None = None
    warnings: list[str] = Field(default_factory=list)


class MealItemOut(BaseModel):
    segment_id: int
    requested_label: str | None = None
    food_id: str | None = None
    volume_cm3: float
    density_g_per_ml: float | None = None
    mass_g: float
    calories_kcal: float = 0.0
    carbs_g: float = 0.0
    protein_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: float = 0.0
    public_claim_eligible: bool = False


class MealEstimateResponse(BaseModel):
    status: str  # "estimated" | "rejected"
    reason: str | None = None
    message: str
    approximate: bool = True
    vision_mode: str  # "models" | "fixture"
    dish: dict | None = None  # {"food_id", "label"} when estimated
    dish_suggestions: list[dict] = Field(default_factory=list)  # CLIP top-3 when dish unconfirmed
    aggregation: str | None = None  # "one-dish" when estimated
    items: list[MealItemOut] = Field(default_factory=list)
    total_volume_cm3: float | None = None
    total_mass_g: float | None = None
    calories_kcal: float | None = None
    carbs_g: float | None = None
    protein_g: float | None = None
    fat_g: float | None = None
    fiber_g: float | None = None
    uncertainty_interval_kcal: tuple[float, float] | None = None
    stage_records: list[StageRecordOut] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    catalog_data_version: str = ""
    catalog_status: str = ""
    confidence: float | None = None
    image_url: str | None = None
    id: str | None = None


class DishInfo(BaseModel):
    food_id: str
    english: str
    urdu: str
    roman_urdu: str
    has_nutrition_profile: bool
