"""Rule-based v1 glucose curve generator.

Inputs: total carbs (g), user weight (kg), activity adjustments.
Output: 4-hour postprandial curve at 5-minute resolution.

This is *educational* only. Real ML model swaps in behind these functions.
"""
from __future__ import annotations
from dataclasses import dataclass
import math

BASELINE_MGDL = 110.0
TARGET_LOW = 70.0
TARGET_HIGH = 180.0
DURATION_MIN = 240
STEP_MIN = 5


@dataclass
class CurvePoint:
    t_min: float
    mgdl: float


def _carb_peak(carbs_g: float, weight_kg: float) -> float:
    """Estimate the postprandial peak rise above baseline."""
    weight = max(weight_kg or 70.0, 35.0)
    # Each gram of carbs raises BG by ~3.5 / weight_kg mg/dL (very rough heuristic).
    rise = carbs_g * (3.5 / weight) * 10.0
    return min(rise, 220.0)


def _activity_multiplier(walk_minutes: int, intensity: str) -> float:
    """Walking after a meal blunts the peak. Bounded to keep UI sensible."""
    if walk_minutes <= 0:
        return 1.0
    factor = walk_minutes / 60.0  # 0..1
    intensity_weight = 0.25 if intensity == "light" else 0.45
    reduction = factor * intensity_weight
    return max(1.0 - reduction, 0.5)


def baseline_curve(carbs_g: float, weight_kg: float | None) -> list[CurvePoint]:
    return _curve(carbs_g, weight_kg, walk_minutes=0, intensity="light", timing_offset_min=0)


def simulated_curve(
    carbs_g: float,
    weight_kg: float | None,
    portion_scale: float,
    walk_minutes: int,
    intensity: str,
    timing_offset_min: int,
) -> list[CurvePoint]:
    return _curve(
        carbs_g * max(0.0, portion_scale),
        weight_kg,
        walk_minutes=walk_minutes,
        intensity=intensity,
        timing_offset_min=timing_offset_min,
    )


def _curve(
    carbs_g: float,
    weight_kg: float | None,
    walk_minutes: int,
    intensity: str,
    timing_offset_min: int,
) -> list[CurvePoint]:
    peak = _carb_peak(carbs_g, weight_kg or 70.0) * _activity_multiplier(walk_minutes, intensity)
    peak_at = 60.0 + (timing_offset_min * 0.3)
    sigma = 35.0
    points: list[CurvePoint] = []
    for t in range(0, DURATION_MIN + 1, STEP_MIN):
        # Gaussian rise centred at peak_at, decaying back to baseline.
        rise = peak * math.exp(-((t - peak_at) ** 2) / (2 * sigma**2))
        points.append(CurvePoint(t_min=float(t), mgdl=round(BASELINE_MGDL + rise, 1)))
    return points


def summarize(points: list[CurvePoint]) -> tuple[float, float, float]:
    """Returns (peak_mgdl, peak_at_min, time_above_range_min)."""
    peak = max(points, key=lambda p: p.mgdl)
    tar = sum(STEP_MIN for p in points if p.mgdl > TARGET_HIGH)
    return peak.mgdl, peak.t_min, float(tar)
