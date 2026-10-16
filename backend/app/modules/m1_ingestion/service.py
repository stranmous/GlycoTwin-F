from app.modules.m1_ingestion.models import NormalizedUserRecord
from app.modules.m1_ingestion.schemas import (
    CGMReadingPayload,
    IngestedUserData,
    MealRecordPayload,
)


def validate_cgm_series(
    readings: list[CGMReadingPayload], require_sorted: bool = True
) -> list[CGMReadingPayload]:
    """Validate CGM time series readings for range limits (20-600 mg/dL) and timestamp ordering."""
    for reading in readings:
        if reading.glucose_mg_dl < 20.0 or reading.glucose_mg_dl > 600.0:
            raise ValueError(
                f"CGM glucose value {reading.glucose_mg_dl} mg/dL is out of physiological range (20-600 mg/dL)."
            )

    if require_sorted and readings:
        timestamps = [item.timestamp for item in readings]
        if timestamps != sorted(timestamps):
            raise ValueError("CGM readings must be ordered by timestamp.")

    return readings


def validate_meal_record(meal: MealRecordPayload) -> MealRecordPayload:
    """Validate meal record payload macronutrients are non-negative."""
    if meal.carbohydrates_g < 0:
        raise ValueError("Carbohydrates must be non-negative.")
    if meal.protein_g < 0:
        raise ValueError("Protein must be non-negative.")
    if meal.fat_g < 0:
        raise ValueError("Fat must be non-negative.")
    if meal.fiber_g < 0:
        raise ValueError("Fiber must be non-negative.")
    return meal


def normalize_ingested_user_data(payload: IngestedUserData) -> IngestedUserData:
    """Clean, order, and normalize multi-modal user data payload for Module 2 ingestion."""
    if payload.cgm_readings:
        # Validate and sort CGM readings
        sorted_cgm = sorted(payload.cgm_readings, key=lambda x: x.timestamp)
        validate_cgm_series(sorted_cgm, require_sorted=False)
        payload.cgm_readings = sorted_cgm

    if payload.meal_records:
        for meal in payload.meal_records:
            validate_meal_record(meal)
        payload.meal_records = sorted(payload.meal_records, key=lambda x: x.timestamp)

    if payload.insulin_doses:
        payload.insulin_doses = sorted(payload.insulin_doses, key=lambda x: x.timestamp)

    return payload


def validate_normalized_record(record: NormalizedUserRecord) -> NormalizedUserRecord:
    """Validate the canonical Module 1 record without mutating it."""
    if record.observations:
        for obs in record.observations:
            if obs.glucose_mg_dl < 20.0 or obs.glucose_mg_dl > 600.0:
                raise ValueError(
                    f"Glucose observation {obs.glucose_mg_dl} mg/dL is out of physiological range (20-600 mg/dL)."
                )
        timestamps = [item.timestamp for item in record.observations]
        if timestamps != sorted(timestamps):
            raise ValueError("Glucose observations must be ordered by timestamp.")
    return record
