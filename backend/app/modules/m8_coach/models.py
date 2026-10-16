from app.modules.m8_coach.schemas import (
    AICoachQuery,
    AICoachResponse,
    MealContextPayload,
    TrajectorySummaryPayload,
)

# Backward-compatibility aliases
CoachRequest = AICoachQuery
CoachResponse = AICoachResponse

__all__ = [
    "AICoachQuery",
    "AICoachResponse",
    "CoachRequest",
    "CoachResponse",
    "MealContextPayload",
    "TrajectorySummaryPayload",
]
