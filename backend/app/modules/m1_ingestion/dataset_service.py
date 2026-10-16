"""
Dataset Ingestion Service for GlycoTwin AI Core Module 1.

Provides high-level dataset loading, gap interpolation, and normalization for clinical benchmark
datasets (OhioT1DM XML/CSV and D1NAMO CSV).
"""

from pathlib import Path

from app.modules.m1_ingestion.loaders.d1namo_loader import D1NAMOLoader
from app.modules.m1_ingestion.loaders.ohio_t1dm_loader import OhioT1DMLoader, interpolate_cgm_gaps
from app.modules.m1_ingestion.schemas import CGMReadingPayload, IngestedUserData


def load_ohio_t1dm_dataset(
    source: str | Path | bytes,
    user_id: str | None = None,
    max_gap_minutes: float = 30.0,
    step_minutes: float = 5.0,
) -> IngestedUserData:
    """
    Load OhioT1DM clinical benchmark file (XML or CSV) into IngestedUserData.
    """
    source_str = str(source) if isinstance(source, Path) else source
    if isinstance(source_str, str) and (
        source_str.endswith(".xml") or "<patient" in source_str or "<?xml" in source_str
    ):
        return OhioT1DMLoader.load_xml(
            source, user_id=user_id, max_gap_minutes=max_gap_minutes, step_minutes=step_minutes
        )
    return OhioT1DMLoader.load_csv(
        source, user_id=user_id or "ohio_patient", max_gap_minutes=max_gap_minutes, step_minutes=step_minutes
    )

def load_d1namo_dataset(
    cgm_source: str | Path,
    meal_source: str | Path | None = None,
    user_id: str = "d1namo_patient",
    max_gap_minutes: float = 30.0,
    step_minutes: float = 5.0,
) -> IngestedUserData:
    """
    Load D1NAMO clinical benchmark files (CGM CSV + optional meal CSV) into IngestedUserData.
    """
    return D1NAMOLoader.load_csv(
        cgm_source=cgm_source,
        meal_source=meal_source,
        user_id=user_id,
        max_gap_minutes=max_gap_minutes,
        step_minutes=step_minutes,
    )

def interpolate_cgm_series(
    readings: list[CGMReadingPayload],
    max_gap_minutes: float = 30.0,
    step_minutes: float = 5.0,
) -> list[CGMReadingPayload]:
    """
    Interpolate missing CGM timestamp gaps up to max_gap_minutes.
    """
    return interpolate_cgm_gaps(readings, max_gap_minutes=max_gap_minutes, step_minutes=step_minutes)

__all__ = [
    "interpolate_cgm_series",
    "load_d1namo_dataset",
    "load_ohio_t1dm_dataset",
]
