from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.modules.m5_nutrition.scale import estimate_reference_scale

HEIGHT_DEPTH_FACTOR = 0.19
# CALIBRATED on Nutrition5k overhead RGB-D (n=80 dishes, CC-BY 4.0):
# least-squares fit of area*mean(relative_depth)*min_dim against weighed
# metric volumes gives k=1.80e-4 m/px (R^2=0.75, MAPE=17.0%). Under RealSense
# D435/D415 overhead geometry this implies a geometric constant of 0.15-0.23;
# 0.19 is the midpoint. Phone capture (angled, closer) differs from the
# overhead rig — re-calibrate with weighed phone photos before trusting
# absolute volumes. See backend/ml/reports/volume_validation.md.
# Volume numbers from this method are approximate by construction — see the
# models-mode warning in pipeline.run.
MIN_ESTIMATED_HEIGHT_CM = 0.05
VOLUME_METHOD = "relative_depth_scaled_area_v2_nutrition5k"


class VolumeEstimationError(ValueError):
    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason
        self.message = message


@dataclass(frozen=True)
class SegmentVolume:
    estimated_height_cm: float
    estimated_volume_cm3: float
    volume_method: str


def _require_positive_float(segment: dict[str, Any], field_name: str) -> float:
    value = segment.get(field_name)
    if not isinstance(value, (int, float)):
        raise VolumeEstimationError(
            "insufficient_volume_metadata",
            f"Segment {segment.get('id', 'unknown')} is missing numeric {field_name}.",
        )

    value = float(value)
    if value <= 0:
        raise VolumeEstimationError(
            "invalid_volume_metadata",
            f"Segment {segment.get('id', 'unknown')} has non-positive {field_name}.",
        )

    return value


def estimate_segment_height_cm(segment: dict[str, Any]) -> float:
    relative_depth_mean = _require_positive_float(segment, "relative_depth_mean")
    estimated_width_cm = _require_positive_float(segment, "estimated_width_cm")
    estimated_height_cm = _require_positive_float(segment, "estimated_height_cm")

    smaller_dimension_cm = min(estimated_width_cm, estimated_height_cm)
    raw_height_cm = relative_depth_mean * smaller_dimension_cm * HEIGHT_DEPTH_FACTOR
    return round(max(MIN_ESTIMATED_HEIGHT_CM, raw_height_cm), 6)


def estimate_segment_volume(segment: dict[str, Any]) -> SegmentVolume:
    area_cm2 = _require_positive_float(segment, "area_cm2")
    height_cm = estimate_segment_height_cm(segment)

    return SegmentVolume(
        estimated_height_cm=height_cm,
        estimated_volume_cm3=round(area_cm2 * height_cm, 6),
        volume_method=VOLUME_METHOD,
    )


def _estimate_volume_for_segments(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    volume_segments: list[dict[str, Any]] = []
    for segment in segments:
        segment_volume = estimate_segment_volume(segment)
        enriched_segment = dict(segment)
        enriched_segment["estimated_height_cm"] = segment_volume.estimated_height_cm
        enriched_segment["estimated_volume_cm3"] = segment_volume.estimated_volume_cm3
        enriched_segment["volume_method"] = segment_volume.volume_method
        volume_segments.append(enriched_segment)

    return volume_segments


def estimate_food_volume(
    image_bytes: bytes,
    content_type: str | None,
    settings: Any,
    reference_object_type: str,
    reference_bbox: list[int] | None,
    confidence_threshold: float,
    max_segments: int,
    scale_estimator: Callable[..., dict[str, Any]] | None = None,
) -> dict[str, Any]:
    scale_estimate = (scale_estimator or estimate_reference_scale)(
        image_bytes=image_bytes,
        content_type=content_type,
        settings=settings,
        reference_object_type=reference_object_type,
        reference_bbox=reference_bbox,
        confidence_threshold=confidence_threshold,
        max_segments=max_segments,
    )

    if scale_estimate["status"] != "scale_estimated":
        return {
            "status": "rejected",
            "reason": scale_estimate.get("reason", "scale_not_estimated"),
            "message": scale_estimate.get("message", "Reference scale is required before volume estimation."),
            "image": scale_estimate.get("image"),
            "reference_object": scale_estimate.get("reference_object"),
            "segments": [],
            "approximate": True,
        }

    volume_segments = _estimate_volume_for_segments(scale_estimate.get("segments", []))

    if not volume_segments:
        raise VolumeEstimationError(
            "no_usable_segments",
            "No scaled food segments had enough depth metadata for volume estimation.",
        )

    return {
        "status": "volume_estimated",
        "reason": None,
        "message": "Approximate food volume estimated from reference scale and relative depth.",
        "image": scale_estimate["image"],
        "reference_object": scale_estimate["reference_object"],
        "segments": volume_segments,
        "approximate": True,
    }
