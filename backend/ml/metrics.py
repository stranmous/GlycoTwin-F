"""WS1 benchmark metrics: per-horizon errors and Clarke Error Grid zones.

Clarke EGA (Clarke et al., Diabetes Care 1987) zone rules as commonly
implemented: A = within 20% (or both hypoglycaemic), E = opposite-action
errors, D = failure-to-detect, C = overcorrection, B = the benign rest.
Unit-tested against hand-classified points in tests/test_ml_metrics.py.
"""
from __future__ import annotations

import math
from collections.abc import Sequence


def rmse(pairs: Sequence[tuple[float, float]]) -> float:
    """pairs of (reference, predicted)."""
    if not pairs:
        raise ValueError("no pairs")
    return math.sqrt(sum((r - p) ** 2 for r, p in pairs) / len(pairs))


def mae(pairs: Sequence[tuple[float, float]]) -> float:
    if not pairs:
        raise ValueError("no pairs")
    return sum(abs(r - p) for r, p in pairs) / len(pairs)


def clarke_zone(ref: float, pred: float) -> str:
    if abs(ref - pred) <= 0.2 * ref or (ref <= 70 and pred <= 70):
        return "A"
    if (ref <= 70 and pred >= 180) or (ref >= 180 and pred <= 70):
        return "E"
    if (ref <= 70 and 70 < pred < 180) or (ref >= 240 and 70 <= pred <= 180):
        return "D"
    if pred - ref >= 110 or (ref - pred >= 110 and pred > 70):
        return "C"
    return "B"


def clarke_summary(pairs: Sequence[tuple[float, float]]) -> dict[str, float]:
    zones = {z: 0 for z in "ABCDE"}
    for ref, pred in pairs:
        zones[clarke_zone(ref, pred)] += 1
    n = len(pairs) or 1
    return {z: round(100.0 * c / n, 1) for z, c in zones.items()}


def horizon_metrics(
    curves: Sequence[tuple[Sequence[float], Sequence[float]]],
    horizons_min: Sequence[int] = (30, 60, 90, 120),
    step_min: int = 5,
) -> dict[str, dict[str, float]]:
    """curves: (actual, predicted) sampled every step_min starting at t=0.

    Returns {horizon: {rmse, mae, n}} using the sample at each horizon.
    """
    out: dict[str, dict[str, float]] = {}
    for h in horizons_min:
        idx = h // step_min
        pairs = [(a[idx], p[idx]) for a, p in curves if len(a) > idx and len(p) > idx]
        if pairs:
            out[str(h)] = {"rmse": round(rmse(pairs), 2), "mae": round(mae(pairs), 2),
                           "n": len(pairs)}
    return out
