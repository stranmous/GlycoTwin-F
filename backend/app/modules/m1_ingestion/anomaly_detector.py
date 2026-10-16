"""CGM Rate-of-Change Calculator and Glucose Anomaly Detection Engine for Module 1."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from app.modules.m1_ingestion.schemas import CGMReadingPayload


class GlucoseAnomaly(BaseModel):
    anomaly_type: str  # "rapid_rise", "rapid_fall", "hyperglycemia", "hypoglycemia", "nocturnal_dip"
    severity: str  # "info", "warning", "critical"
    message: str
    timestamp: datetime
    glucose_mg_dl: float
    rate_of_change_mg_dl_min: float | None = None


class AnomalyDetectionRequest(BaseModel):
    user_id: str = Field(default="unknown", min_length=1)
    cgm_readings: list[CGMReadingPayload] = Field(default_factory=list)


class AnomalyDetectionResult(BaseModel):
    user_id: str
    total_readings_analyzed: int
    anomalies_detected: list[GlucoseAnomaly]
    max_rate_of_change_mg_dl_min: float | None = None
    min_rate_of_change_mg_dl_min: float | None = None
    detected_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


def calculate_rates_of_change(readings: list[CGMReadingPayload]) -> list[float | None]:
    """Compute glucose rate-of-change (dG/dt) in mg/dL per minute between adjacent time-series readings.

    Returns a list of floats (dG/dt in mg/dL/min) of the same length as readings.
    The first element is None as there is no preceding reading.
    """
    if not readings:
        return []

    rates: list[float | None] = [None]
    for i in range(1, len(readings)):
        prev_reading = readings[i - 1]
        curr_reading = readings[i]

        delta_t_minutes = (curr_reading.timestamp - prev_reading.timestamp).total_seconds() / 60.0
        if delta_t_minutes <= 0:
            rates.append(0.0)
            continue

        delta_g = curr_reading.glucose_mg_dl - prev_reading.glucose_mg_dl
        roc = delta_g / delta_t_minutes
        rates.append(round(roc, 3))

    return rates


def detect_cgm_anomalies(
    readings: list[CGMReadingPayload],
    user_id: str = "unknown",
) -> AnomalyDetectionResult:
    """Analyze CGM time-series readings for rapid rise, rapid fall, nocturnal dips, and glycemic threshold breaches."""
    if not readings:
        return AnomalyDetectionResult(
            user_id=user_id,
            total_readings_analyzed=0,
            anomalies_detected=[],
        )

    # Ensure readings are chronologically sorted
    sorted_readings = sorted(readings, key=lambda r: r.timestamp)
    rates_of_change = calculate_rates_of_change(sorted_readings)

    anomalies: list[GlucoseAnomaly] = []
    valid_rocs = [roc for roc in rates_of_change if roc is not None]

    max_roc = max(valid_rocs) if valid_rocs else None
    min_roc = min(valid_rocs) if valid_rocs else None

    for idx, reading in enumerate(sorted_readings):
        roc = rates_of_change[idx]
        dt = reading.timestamp
        g_val = reading.glucose_mg_dl

        # 1. Hyperglycemia Detection
        if g_val >= 250.0:
            anomalies.append(
                GlucoseAnomaly(
                    anomaly_type="hyperglycemia",
                    severity="critical",
                    message=f"Severe hyperglycemia detected ({g_val:.1f} mg/dL >= 250 mg/dL)",
                    timestamp=dt,
                    glucose_mg_dl=g_val,
                    rate_of_change_mg_dl_min=roc,
                )
            )
        elif g_val >= 180.0:
            anomalies.append(
                GlucoseAnomaly(
                    anomaly_type="hyperglycemia",
                    severity="warning",
                    message=f"Elevated glucose spike detected ({g_val:.1f} mg/dL >= 180 mg/dL)",
                    timestamp=dt,
                    glucose_mg_dl=g_val,
                    rate_of_change_mg_dl_min=roc,
                )
            )

        # 2. Hypoglycemia Detection
        if g_val <= 54.0:
            anomalies.append(
                GlucoseAnomaly(
                    anomaly_type="hypoglycemia",
                    severity="critical",
                    message=f"Severe hypoglycemia threshold breached ({g_val:.1f} mg/dL <= 54 mg/dL)",
                    timestamp=dt,
                    glucose_mg_dl=g_val,
                    rate_of_change_mg_dl_min=roc,
                )
            )
        elif g_val <= 70.0:
            anomalies.append(
                GlucoseAnomaly(
                    anomaly_type="hypoglycemia",
                    severity="warning",
                    message=f"Hypoglycemia alert threshold breached ({g_val:.1f} mg/dL <= 70 mg/dL)",
                    timestamp=dt,
                    glucose_mg_dl=g_val,
                    rate_of_change_mg_dl_min=roc,
                )
            )

        # 3. Rapid Rate-of-Change Detection
        if roc is not None:
            if roc >= 3.0:
                anomalies.append(
                    GlucoseAnomaly(
                        anomaly_type="rapid_rise",
                        severity="critical",
                        message=f"Extreme rapid glucose rise detected (+{roc:.2f} mg/dL/min)",
                        timestamp=dt,
                        glucose_mg_dl=g_val,
                        rate_of_change_mg_dl_min=roc,
                    )
                )
            elif roc >= 2.0:
                anomalies.append(
                    GlucoseAnomaly(
                        anomaly_type="rapid_rise",
                        severity="warning",
                        message=f"Rapid glucose rise detected (+{roc:.2f} mg/dL/min)",
                        timestamp=dt,
                        glucose_mg_dl=g_val,
                        rate_of_change_mg_dl_min=roc,
                    )
                )
            elif roc <= -3.0:
                anomalies.append(
                    GlucoseAnomaly(
                        anomaly_type="rapid_fall",
                        severity="critical",
                        message=f"Extreme rapid glucose fall detected ({roc:.2f} mg/dL/min)",
                        timestamp=dt,
                        glucose_mg_dl=g_val,
                        rate_of_change_mg_dl_min=roc,
                    )
                )
            elif roc <= -2.0:
                anomalies.append(
                    GlucoseAnomaly(
                        anomaly_type="rapid_fall",
                        severity="warning",
                        message=f"Rapid glucose drop detected ({roc:.2f} mg/dL/min)",
                        timestamp=dt,
                        glucose_mg_dl=g_val,
                        rate_of_change_mg_dl_min=roc,
                    )
                )

        # 4. Nocturnal Dip Detection (00:00 - 06:00)
        hour = dt.hour
        if 0 <= hour < 6 and ((roc is not None and roc <= -1.5) or g_val <= 80.0):
                anomalies.append(
                    GlucoseAnomaly(
                        anomaly_type="nocturnal_dip",
                        severity="warning" if g_val > 70.0 else "critical",
                        message=f"Nocturnal glucose dip detected during sleep hours ({hour:02d}:00, {g_val:.1f} mg/dL)",
                        timestamp=dt,
                        glucose_mg_dl=g_val,
                        rate_of_change_mg_dl_min=roc,
                    )
                )

    return AnomalyDetectionResult(
        user_id=user_id,
        total_readings_analyzed=len(sorted_readings),
        anomalies_detected=anomalies,
        max_rate_of_change_mg_dl_min=max_roc,
        min_rate_of_change_mg_dl_min=min_roc,
    )
