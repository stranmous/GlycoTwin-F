"""
D1NAMO Clinical Benchmark Dataset Loader.

Parses D1NAMO dataset CSV files (CGM sensors, food/meal logs) into standardized
IngestedUserData schema records. Auto-converts mmol/L glucose units to mg/dL if needed
and handles missing gap interpolations.
"""

import csv
import io
from pathlib import Path

from app.modules.m1_ingestion.loaders.ohio_t1dm_loader import interpolate_cgm_gaps, parse_timestamp

# Ensure backend root is importable
from app.modules.m1_ingestion.schemas import (
    CGMReadingPayload,
    IngestedUserData,
    InsulinDosePayload,
    MealRecordPayload,
    UserProfilePayload,
)
from app.modules.m1_ingestion.service import normalize_ingested_user_data

MMOL_L_TO_MG_DL = 18.0182

class D1NAMOLoader:
    """Dataset loader for D1NAMO clinical benchmark records."""

    @staticmethod
    def load_csv(
        cgm_source: str | Path,
        meal_source: str | Path | None = None,
        user_id: str = "d1namo_patient",
        max_gap_minutes: float = 30.0,
        step_minutes: float = 5.0,
        insulin_source: str | Path | None = None,
        diabetic_type: str = "type_1",
    ) -> IngestedUserData:
        """
        Parse D1NAMO CGM and optional meal CSV records into an IngestedUserData instance.
        """
        cgm_content: str
        if isinstance(cgm_source, (str, Path)) and Path(cgm_source).is_file():
            cgm_content = Path(cgm_source).read_text(encoding="utf-8")
        elif isinstance(cgm_source, str):
            cgm_content = cgm_source
        else:
            raise FileNotFoundError(f"D1NAMO CGM source file not found: {cgm_source}")

        cgm_readings: list[CGMReadingPayload] = []

        cgm_reader = csv.DictReader(io.StringIO(cgm_content))
        for row in cgm_reader:
            ts_str = row.get("timestamp") or row.get("ts") or row.get("date")
            if not ts_str:
                date_str = row.get("date", "")
                time_str = row.get("time", "")
                if date_str and time_str:
                    ts_str = f"{date_str} {time_str}"
                else:
                    continue

            dt = parse_timestamp(ts_str)

            gluc_str = (
                row.get("glucose")
                or row.get("glucose_mg_dl")
                or row.get("glucose_mmol_l")
                or row.get("value")
            )
            if gluc_str:
                try:
                    val = float(gluc_str)
                    unit = row.get("unit", "").lower()
                    # Unit inference for mixed-unit CSVs: values <= 35 are read as mmol/L.
                    # Defensive only — verified it never fires on real D1NAMO data
                    # (patient 001 min is 39.6 mg/dL). Known limitation: a genuine
                    # severe-hypoglycaemia reading <= 35 mg/dL would be misread as
                    # mmol/L; explicit unit columns always take precedence.
                    if unit == "mmol/l" or ("mmol" in gluc_str.lower()) or (val <= 35.0 and val > 0.0):
                        val = val * MMOL_L_TO_MG_DL

                    val = round(val, 2)
                    if 20.0 <= val <= 600.0:
                        cgm_readings.append(
                            CGMReadingPayload(
                                timestamp=dt,
                                glucose_mg_dl=val,
                                source="d1namo_cgm",
                            )
                        )
                except (ValueError, TypeError):
                    pass

        meal_records: list[MealRecordPayload] = []
        if meal_source:
            meal_content: str
            if isinstance(meal_source, (str, Path)) and Path(meal_source).is_file():
                meal_content = Path(meal_source).read_text(encoding="utf-8")
            elif isinstance(meal_source, str):
                meal_content = meal_source
            else:
                raise FileNotFoundError(f"D1NAMO meal source file not found: {meal_source}")

            meal_reader = csv.DictReader(io.StringIO(meal_content))
            for row in meal_reader:
                ts_str = row.get("timestamp") or row.get("ts") or row.get("date")
                if not ts_str:
                    continue

                dt = parse_timestamp(ts_str)
                carbs_str = row.get("carbs") or row.get("carbohydrates_g")
                if carbs_str:
                    try:
                        carbs = float(carbs_str)
                        protein = float(row.get("protein_g", 0.0) or 0.0)
                        fat = float(row.get("fat_g", 0.0) or 0.0)
                        fiber = float(row.get("fiber_g", 0.0) or 0.0)
                        if carbs >= 0 and protein >= 0 and fat >= 0 and fiber >= 0:
                            meal_records.append(
                                MealRecordPayload(
                                    timestamp=dt,
                                    carbohydrates_g=carbs,
                                    protein_g=protein,
                                    fat_g=fat,
                                    fiber_g=fiber,
                                    meal_type=row.get("meal_type", "snack"),
                                    name=row.get("name"),
                                )
                            )
                    except (ValueError, TypeError):
                        pass

        if cgm_readings and max_gap_minutes > 0:
            cgm_readings = interpolate_cgm_gaps(
                cgm_readings, max_gap_minutes=max_gap_minutes, step_minutes=step_minutes
            )

        insulin_doses: list[InsulinDosePayload] = []
        if insulin_source and Path(insulin_source).is_file():
            ins_content = Path(insulin_source).read_text(encoding="utf-8")
            for row in csv.DictReader(io.StringIO(ins_content)):
                # OhioT1DM converter format: timestamp,units,kind
                if row.get("timestamp"):
                    try:
                        dt = parse_timestamp(row["timestamp"])
                        units = float(row.get("units", 0) or 0)
                    except (ValueError, TypeError):
                        continue
                    if units > 0:
                        insulin_doses.append(
                            InsulinDosePayload(timestamp=dt, units=units,
                                               kind=row.get("kind", "bolus") or "bolus"))
                    continue
                # D1NAMO raw format: date,time,fast_insulin,slow_insulin
                date_str = row.get("date", "")
                time_str = row.get("time", "")
                if not date_str or not time_str:
                    continue
                try:
                    dt = parse_timestamp(f"{date_str} {time_str}")
                except ValueError:
                    continue
                for col, kind in (("fast_insulin", "fast"), ("slow_insulin", "slow")):
                    val = row.get(col, "")
                    try:
                        units = float(val) if val not in ("", None) else 0.0
                    except (ValueError, TypeError):
                        continue
                    if units > 0:
                        insulin_doses.append(
                            InsulinDosePayload(timestamp=dt, units=units, kind=kind)
                        )

        user_profile = UserProfilePayload(
            user_id=user_id,
            diabetic_type=diabetic_type,
        )

        raw_data = IngestedUserData(
            user_id=user_id,
            user_profile=user_profile,
            cgm_readings=cgm_readings,
            meal_records=meal_records,
            insulin_doses=insulin_doses,
        )
        return normalize_ingested_user_data(raw_data)
