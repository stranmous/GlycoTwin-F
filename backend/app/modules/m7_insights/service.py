"""M7 Time-in-Range — the report's primary insight metric (70–180 mg/dL).

Pure functions over a glucose series so the dashboard, tests, and the demo
frontend all share one definition. Works for CGM readings and for M3
prediction trajectories alike (both are just glucose series).
"""
import statistics

DEFAULT_LOW = 70.0
DEFAULT_HIGH = 180.0


def compute_time_in_range(
    values: list[float], low: float = DEFAULT_LOW, high: float = DEFAULT_HIGH
) -> dict:
    if not values:
        raise ValueError("at least one glucose reading is required")
    if low >= high:
        raise ValueError("low threshold must be below high threshold")

    n = len(values)
    below = sum(1 for v in values if v < low)
    above = sum(1 for v in values if v > high)
    in_range = n - below - above

    mean = statistics.fmean(values)
    sd = statistics.pstdev(values) if n > 1 else 0.0
    return {
        "n": n,
        "low": low,
        "high": high,
        "below_count": below,
        "in_range_count": in_range,
        "above_count": above,
        "below_pct": round(100 * below / n, 1),
        "in_range_pct": round(100 * in_range / n, 1),
        "above_pct": round(100 * above / n, 1),
        "mean_mg_dl": round(mean, 1),
        "sd_mg_dl": round(sd, 1),
        "cv_pct": round(100 * sd / mean, 1) if mean else 0.0,
        # Glucose Management Indicator (Bergenstal et al., 2018)
        "gmi_pct": round(3.31 + 0.02392 * mean, 2),
    }
