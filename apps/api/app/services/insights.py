"""Compute insights from stored predictions/meals.

v1 derives everything from `predictions` table. Real CGM ingestion is a v2 add.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meal import Meal
from app.models.prediction import Prediction
from app.schemas.insight import (
    InsightCard,
    InsightsSummary,
    SpikeMeal,
    TirSummary,
)

TARGET_LOW = 70.0
TARGET_HIGH = 180.0


def _window_start(window: str) -> datetime:
    now = datetime.now(timezone.utc)
    if window == "today":
        return now - timedelta(hours=24)
    if window == "7d":
        return now - timedelta(days=7)
    return now - timedelta(days=30)


async def build_summary(session: AsyncSession, user_id, window: str) -> InsightsSummary:
    from sqlalchemy.orm import selectinload

    start = _window_start(window)
    rows = await session.execute(
        select(Prediction, Meal)
        .join(Meal, Meal.id == Prediction.meal_id)
        .options(selectinload(Meal.detected_foods))
        .where(Prediction.user_id == user_id, Prediction.created_at >= start)
    )
    pairs = rows.all()

    in_range = above = below = total = 0
    by_type: dict[str, list[float]] = {}
    spikes: list[tuple[float, str, str]] = []

    for pred, meal in pairs:
        for pt in pred.curve:
            mgdl = pt["mgdl"]
            total += 1
            if mgdl < TARGET_LOW:
                below += 1
            elif mgdl > TARGET_HIGH:
                above += 1
            else:
                in_range += 1
        by_type.setdefault(meal.meal_type or "other", []).append(pred.peak_mgdl)
        label = ", ".join(f.name_en for f in meal.detected_foods[:2]) or "Meal"
        spikes.append((pred.peak_mgdl, str(meal.id), label))

    spikes.sort(key=lambda s: s[0], reverse=True)
    top = [SpikeMeal(meal_id=mid, label=label, peak_mgdl=peak) for peak, mid, label in spikes[:3]]
    avg_peak = {k: round(sum(v) / len(v), 1) for k, v in by_type.items() if v}

    cards: list[InsightCard] = []
    if total:
        in_range_pct = in_range / total * 100
        if in_range_pct >= 70:
            cards.append(
                InsightCard(
                    id="tir-good",
                    title_en="Strong Time-in-Range",
                    title_ur="ہدف کی حد میں اچھا وقت",
                    body_en=f"You spent {in_range_pct:.0f}% of the window in 70-180 mg/dL.",
                    body_ur=f"آپ نے {in_range_pct:.0f}٪ وقت 70-180 mg/dL کے درمیان گزارا۔",
                    severity="good",
                )
            )
        elif in_range_pct < 50:
            cards.append(
                InsightCard(
                    id="tir-low",
                    title_en="Time-in-Range is low",
                    title_ur="ہدف کی حد میں وقت کم ہے",
                    body_en="Try a 15-minute walk after rice-heavy meals to flatten peaks.",
                    body_ur="چاول والے کھانے کے بعد 15 منٹ کی چہل قدمی آزمائیں۔",
                    severity="warn",
                )
            )

    summary = InsightsSummary(
        window=window,  # type: ignore[arg-type]
        tir=TirSummary(
            in_range_pct=round((in_range / total * 100) if total else 0.0, 1),
            above_range_pct=round((above / total * 100) if total else 0.0, 1),
            below_range_pct=round((below / total * 100) if total else 0.0, 1),
            sample_count=total,
        ),
        avg_peak_by_meal_type=avg_peak,
        top_spike_meals=top,
        cards=cards,
    )
    return summary
