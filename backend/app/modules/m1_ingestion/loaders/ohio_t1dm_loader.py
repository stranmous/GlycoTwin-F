"""
OhioT1DM Clinical Benchmark Dataset Loader.

Parses OhioT1DM dataset XML/CSV files into standardized IngestedUserData schemas.
Handles timestamp parsing, missing value filtering, range validation, and linear
interpolation of missing CGM data gaps.
"""

import io
import xml.etree.ElementTree as ET
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Ensure backend root is importable
from app.modules.m1_ingestion.schemas import (
    CGMReadingPayload,
    IngestedUserData,
    InsulinDosePayload,
    MealRecordPayload,
    UserProfilePayload,
)
from app.modules.m1_ingestion.service import normalize_ingested_user_data


def parse_timestamp(ts_val: str | datetime) -> datetime:
    """Parse string timestamp into timezone-aware UTC datetime."""
    if isinstance(ts_val, datetime):
        if ts_val.tzinfo is None:
            return ts_val.replace(tzinfo=UTC)
        return ts_val.astimezone(UTC)

    ts_str = str(ts_val).strip()
    formats = [
        "%d-%m-%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(ts_str, fmt)
            return dt.replace(tzinfo=UTC)
        except ValueError:
            pass

    try:
        dt = datetime.fromisoformat(ts_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except ValueError:
        raise ValueError(f"Could not parse timestamp string: '{ts_str}'")

def interpolate_cgm_gaps(
    readings: list[CGMReadingPayload],
    max_gap_minutes: float = 30.0,
    step_minutes: float = 5.0,
) -> list[CGMReadingPayload]:
    """
    Linearly interpolate missing CGM readings for time gaps <= max_gap_minutes.
    Gaps greater than max_gap_minutes are preserved without interpolation.
    """
    if not readings or len(readings) < 2:
        return readings

    sorted_readings = sorted(readings, key=lambda r: r.timestamp)
    interpolated: list[CGMReadingPayload] = []

    for i in range(len(sorted_readings) - 1):
        curr_r = sorted_readings[i]
        next_r = sorted_readings[i + 1]
        interpolated.append(curr_r)

        delta_sec = (next_r.timestamp - curr_r.timestamp).total_seconds()
        step_sec = step_minutes * 60.0
        max_gap_sec = max_gap_minutes * 60.0

        if step_sec < delta_sec <= max_gap_sec:
            num_steps = round(delta_sec / step_sec)
            if num_steps > 1:
                g_diff = next_r.glucose_mg_dl - curr_r.glucose_mg_dl
                for step_idx in range(1, num_steps):
                    frac = step_idx / num_steps
                    interp_time = curr_r.timestamp + timedelta(seconds=step_idx * step_sec)
                    interp_val = curr_r.glucose_mg_dl + frac * g_diff

                    interp_val = max(20.0, min(600.0, round(interp_val, 2)))
                    interpolated.append(
                        CGMReadingPayload(
                            timestamp=interp_time,
                            glucose_mg_dl=interp_val,
                            source=f"{curr_r.source}_interpolated",
                            trend=curr_r.trend,
                        )
                    )

    interpolated.append(sorted_readings[-1])
    return interpolated

class OhioT1DMLoader:
    """Dataset ingestion loader for OhioT1DM clinical benchmark data."""

    @staticmethod
    def load_xml(
        source: str | Path | bytes | ET.Element,
        user_id: str | None = None,
        max_gap_minutes: float = 30.0,
        step_minutes: float = 5.0,
    ) -> IngestedUserData:
        """
        Parse OhioT1DM XML data into an IngestedUserData schema instance.
        """
        root: ET.Element
        if isinstance(source, ET.Element):
            root = source
        elif isinstance(source, bytes):
            root = ET.fromstring(source.decode("utf-8"))
        elif isinstance(source, (str, Path)):
            path_obj = Path(source)
            if path_obj.is_file():
                tree = ET.parse(path_obj)
                root = tree.getroot()
            elif isinstance(source, str) and ("<patient" in source or "<?xml" in source):
                root = ET.fromstring(source)
            else:
                raise FileNotFoundError(f"OhioT1DM XML source file not found: {source}")
        else:
            raise TypeError(f"Unsupported XML source type: {type(source)}")

        # Extract patient metadata
        pid = user_id or root.attrib.get("id") or root.attrib.get("patient_id") or "ohio_patient"
        age = int(root.attrib["age"]) if "age" in root.attrib and root.attrib["age"].isdigit() else None

        user_profile = UserProfilePayload(
            user_id=pid,
            age=age,
            bmi=None,
            diabetic_type="type_1",
        )

        cgm_readings: list[CGMReadingPayload] = []
        meal_records: list[MealRecordPayload] = []
        insulin_doses: list[InsulinDosePayload] = []

        # Parse glucose_level events
        for elem in root.findall(".//glucose_level/event") + root.findall(".//glucose/event"):
            ts_str = elem.attrib.get("ts") or elem.attrib.get("timestamp")
            val_str = elem.attrib.get("value") or elem.attrib.get("glucose")
            if ts_str and val_str:
                try:
                    val = float(val_str)
                    if 20.0 <= val <= 600.0:
                        dt = parse_timestamp(ts_str)
                        cgm_readings.append(
                            CGMReadingPayload(
                                timestamp=dt,
                                glucose_mg_dl=val,
                                source="ohio_t1dm_cgm",
                            )
                        )
                except (ValueError, TypeError):
                    continue

        # Parse meal events
        for elem in root.findall(".//meal/event"):
            ts_str = elem.attrib.get("ts") or elem.attrib.get("timestamp")
            carbs_str = elem.attrib.get("carbs") or elem.attrib.get("carbohydrates_g")
            meal_type = elem.attrib.get("type", "snack")
            name = elem.attrib.get("name")
            if ts_str and carbs_str:
                try:
                    carbs = float(carbs_str)
                    if carbs >= 0:
                        dt = parse_timestamp(ts_str)
                        meal_records.append(
                            MealRecordPayload(
                                timestamp=dt,
                                carbohydrates_g=carbs,
                                meal_type=meal_type,
                                name=name,
                            )
                        )
                except (ValueError, TypeError):
                    continue

        # Parse bolus insulin events (exogenous insulin; T1D patients inject)
        for elem in root.findall(".//bolus/event"):
            ts_str = elem.attrib.get("ts_begin") or elem.attrib.get("ts") or elem.attrib.get("timestamp")
            dose_str = elem.attrib.get("dose")
            if ts_str and dose_str:
                try:
                    dose = float(dose_str)
                    if dose > 0:
                        insulin_doses.append(
                            InsulinDosePayload(
                                timestamp=parse_timestamp(ts_str),
                                units=dose,
                                kind="bolus",
                            )
                        )
                except (ValueError, TypeError):
                    continue

        # Apply gap interpolation if requested
        if cgm_readings and max_gap_minutes > 0:
            cgm_readings = interpolate_cgm_gaps(
                cgm_readings, max_gap_minutes=max_gap_minutes, step_minutes=step_minutes
            )

        raw_data = IngestedUserData(
            user_id=pid,
            user_profile=user_profile,
            cgm_readings=cgm_readings,
            meal_records=meal_records,
            insulin_doses=insulin_doses,
        )
        return normalize_ingested_user_data(raw_data)

    @staticmethod
    def load_csv(
        source: str | Path,
        user_id: str = "ohio_patient",
        max_gap_minutes: float = 30.0,
        step_minutes: float = 5.0,
    ) -> IngestedUserData:
        """
        Parse OhioT1DM CSV data into an IngestedUserData schema instance.
        """
        import csv

        content: str
        if isinstance(source, (str, Path)) and Path(source).is_file():
            content = Path(source).read_text(encoding="utf-8")
        elif isinstance(source, str):
            content = source
        else:
            raise FileNotFoundError(f"CSV source not found: {source}")

        cgm_readings: list[CGMReadingPayload] = []
        meal_records: list[MealRecordPayload] = []
        insulin_doses: list[InsulinDosePayload] = []

        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            ts_str = row.get("timestamp") or row.get("ts") or row.get("date")
            if not ts_str:
                continue

            dt = parse_timestamp(ts_str)

            # Glucose reading check
            gluc_str = row.get("glucose") or row.get("glucose_mg_dl") or row.get("value")
            if gluc_str:
                try:
                    val = float(gluc_str)
                    if 20.0 <= val <= 600.0:
                        cgm_readings.append(
                            CGMReadingPayload(
                                timestamp=dt,
                                glucose_mg_dl=val,
                                source="ohio_t1dm_csv",
                            )
                        )
                except (ValueError, TypeError):
                    pass

            # Meal reading check
            carbs_str = row.get("carbs") or row.get("carbohydrates_g")
            if carbs_str:
                try:
                    carbs = float(carbs_str)
                    if carbs >= 0:
                        meal_records.append(
                            MealRecordPayload(
                                timestamp=dt,
                                carbohydrates_g=carbs,
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

        user_profile = UserProfilePayload(
            user_id=user_id,
            diabetic_type="type_1",
        )

        raw_data = IngestedUserData(
            user_id=user_id,
            user_profile=user_profile,
            cgm_readings=cgm_readings,
            meal_records=meal_records,
            insulin_doses=insulin_doses,
        )
        return normalize_ingested_user_data(raw_data)
