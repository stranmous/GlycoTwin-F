"""Meal-window extraction: turn a patient's history into supervised examples.

A window is one meal event plus the 120 minutes of CGM that followed it,
resampled onto the serving grid (0..120 min every 5 min = 25 points, exactly
what M3 predicts). Windows with insufficient CGM coverage are dropped rather
than interpolated into fiction; coverage is recorded for the model card.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.modules.m1_ingestion.schemas import IngestedUserData

GRID_MIN = list(range(0, 121, 5))
MIN_COVERAGE = 20  # of 25 grid points must have a real reading nearby

# Exogenous bolus insulin model (shared with ode_solver.py): rapid-acting
# bolus decays with ~28 min half-life; only fast/bolus doses enter the
# compartment, slow/basal doses are background and excluded.
BOLUS_DECAY_PER_MIN = 0.025
IOB_LOOKBACK_MIN = 240   # insulin-on-board window before the meal
BOLUS_FWD_MIN = 120      # doses after meal start still shape the 2h curve


def _bolus_kind(kind: str) -> bool:
    return kind.lower() in ("bolus", "fast")


@dataclass
class MealWindow:
    patient_id: str
    carbs_g: float
    protein_g: float
    fat_g: float
    start_glucose: float          # CGM at (or just before) meal time
    actual: list[float]           # 25 values on GRID_MIN
    coverage: int                 # real readings used (<= 25)
    meal_time: datetime | None = None
    trend_30min: float | None = None   # mg/dL per 30 min before the meal
    insulin_on_board: float = 0.0     # decayed bolus units in the 4h pre-meal
    bolus_doses: list[tuple[float, float]] = field(default_factory=list)
    # (offset_minutes_from_meal, units) for fast/bolus doses in
    # [-IOB_LOOKBACK_MIN, +BOLUS_FWD_MIN]; feeds the ODE bolus compartment


def _interp(sorted_ts, sorted_vals, target) -> float | None:
    """Linear interpolation; None if target is outside the series or the
    bracketing gap exceeds 30 minutes."""
    import bisect

    i = bisect.bisect_left(sorted_ts, target)
    if i == 0 or i >= len(sorted_ts):
        # allow exact endpoint hits
        if i < len(sorted_ts) and sorted_ts[i] == target:
            return sorted_vals[i]
        if i == len(sorted_ts) and sorted_ts[-1] == target:
            return sorted_vals[-1]
        return None
    t0, t1 = sorted_ts[i - 1], sorted_ts[i]
    if (t1 - t0) > timedelta(minutes=30):
        return None
    frac = (target - t0) / (t1 - t0)
    return sorted_vals[i - 1] + frac * (sorted_vals[i] - sorted_vals[i - 1])


def extract_windows(user: IngestedUserData, horizon_min: int = 120) -> list[MealWindow]:
    readings = sorted(user.cgm_readings, key=lambda r: r.timestamp)
    if not readings:
        return []
    ts = [r.timestamp for r in readings]
    vals = [r.glucose_mg_dl for r in readings]
    doses = sorted(user.insulin_doses, key=lambda d: d.timestamp)

    windows: list[MealWindow] = []
    for meal in sorted(user.meal_records, key=lambda m: m.timestamp):
        if meal.carbohydrates_g <= 0:
            continue
        start_val = _interp(ts, vals, meal.timestamp)
        if start_val is None:
            continue
        actual: list[float] = []
        coverage = 0
        for offset in GRID_MIN:
            if offset > horizon_min:
                break
            v = _interp(ts, vals, meal.timestamp + timedelta(minutes=offset))
            if v is None:
                # grid must be complete: mark gap, decide by coverage below
                actual.append(float("nan"))
            else:
                actual.append(v)
                coverage += 1
        if coverage < MIN_COVERAGE:
            continue
        # fill the few missing points by carrying neighbours (flagged by coverage)
        last = start_val
        filled = []
        for v in actual:
            if math.isnan(v):
                filled.append(last)
            else:
                filled.append(v)
                last = v
        # 30-minute pre-meal trend (mg/dL per 30 min); None if no reading
        pre = _interp(ts, vals, meal.timestamp - timedelta(minutes=30))
        trend = (start_val - pre) if pre is not None else None
        # insulin on board: decayed fast/bolus doses in the 4h before the meal
        iob = 0.0
        bolus_doses: list[tuple[float, float]] = []
        for d in doses:
            if not _bolus_kind(d.kind):
                continue
            delta_min = (d.timestamp - meal.timestamp).total_seconds() / 60.0
            if -IOB_LOOKBACK_MIN <= delta_min <= BOLUS_FWD_MIN:
                bolus_doses.append((delta_min, d.units))
                if delta_min <= 0:
                    iob += d.units * math.exp(BOLUS_DECAY_PER_MIN * delta_min)
        windows.append(MealWindow(
            patient_id=user.user_id,
            carbs_g=meal.carbohydrates_g,
            protein_g=meal.protein_g,
            fat_g=meal.fat_g,
            start_glucose=start_val,
            actual=filled,
            coverage=coverage,
            meal_time=meal.timestamp,
            trend_30min=trend,
            insulin_on_board=iob,
            bolus_doses=bolus_doses,
        ))
    return windows
