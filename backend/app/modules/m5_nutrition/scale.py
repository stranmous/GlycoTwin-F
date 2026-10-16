from __future__ import annotations

import json
import math
from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import Any

from app.modules.m5_nutrition.depth import estimate_food_depth

REFERENCE_OBJECTS_CM = {
    "coin": {"diameter_cm": 2.4},
    "spoon": {"length_cm": 16.0},
    "card": {"width_cm": 8.56, "height_cm": 5.398},
}
MIN_REFERENCE_PIXELS = 8
MIN_CM_PER_PIXEL = 0.005
MAX_CM_PER_PIXEL = 1.0
MAX_REFERENCE_FOOD_IOU = 0.35
COIN_MIN_ASPECT_RATIO = 0.7
COIN_MAX_ASPECT_RATIO = 1.3


class ScaleCalibrationError(ValueError):
    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason
        self.message = message


@dataclass(frozen=True)
class ReferenceScale:
    type: str
    bbox: list[int]
    known_size_cm: dict[str, float]
    pixel_width: int
    pixel_height: int
    reference_pixels: float
    cm_per_pixel: float


def get_reference_object_dimensions(reference_object_type: str) -> dict[str, float]:
    normalized_type = reference_object_type.strip().lower()
    dimensions = REFERENCE_OBJECTS_CM.get(normalized_type)
    if dimensions is None:
        supported = ", ".join(sorted(REFERENCE_OBJECTS_CM))
        raise ScaleCalibrationError(
            "unsupported_reference_object",
            f"Unsupported reference object. Supported objects: {supported}.",
        )
    return dimensions


def parse_reference_bbox(reference_bbox: str | None) -> list[int] | None:
    if reference_bbox is None or not reference_bbox.strip():
        return None

    try:
        parsed = json.loads(reference_bbox)
    except json.JSONDecodeError as exc:
        raise ScaleCalibrationError(
            "invalid_reference_bbox",
            "reference_bbox must be a JSON array in [x_min, y_min, x_max, y_max] format.",
        ) from exc

    if not isinstance(parsed, list) or len(parsed) != 4:
        raise ScaleCalibrationError(
            "invalid_reference_bbox",
            "reference_bbox must contain exactly four numeric values.",
        )

    try:
        return [round(float(value)) for value in parsed]
    except (TypeError, ValueError) as exc:
        raise ScaleCalibrationError(
            "invalid_reference_bbox",
            "reference_bbox values must be numeric.",
        ) from exc


def _clip_bbox_to_image(bbox: list[int], image_width: int, image_height: int) -> list[int]:
    if len(bbox) != 4:
        raise ScaleCalibrationError(
            "invalid_reference_bbox",
            "reference_bbox must contain exactly four values.",
        )

    x_min = max(0, min(image_width, int(bbox[0])))
    y_min = max(0, min(image_height, int(bbox[1])))
    x_max = max(0, min(image_width, int(bbox[2])))
    y_max = max(0, min(image_height, int(bbox[3])))
    if x_max <= x_min or y_max <= y_min:
        raise ScaleCalibrationError(
            "invalid_reference_bbox",
            "Reference object bounding box must overlap the image with non-zero area.",
        )

    return [x_min, y_min, x_max, y_max]


def _known_reference_pixels(
    reference_object_type: str,
    dimensions: dict[str, float],
    pixel_width: int,
    pixel_height: int,
) -> tuple[float, float]:
    if reference_object_type == "card":
        cm_per_pixel_width = dimensions["width_cm"] / pixel_width
        cm_per_pixel_height = dimensions["height_cm"] / pixel_height
        return (pixel_width + pixel_height) / 2, (cm_per_pixel_width + cm_per_pixel_height) / 2

    if reference_object_type == "coin":
        reference_pixels = (pixel_width + pixel_height) / 2
        return reference_pixels, dimensions["diameter_cm"] / reference_pixels

    reference_pixels = math.hypot(pixel_width, pixel_height)
    return reference_pixels, dimensions["length_cm"] / reference_pixels


def _bbox_iou(bbox_a: list[int], bbox_b: list[int]) -> float:
    ax1, ay1, ax2, ay2 = bbox_a
    bx1, by1, bx2, by2 = bbox_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    if inter_area == 0:
        return 0.0

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter_area
    if union <= 0:
        return 0.0
    return inter_area / union


def _validate_coin_bbox_shape(pixel_width: int, pixel_height: int) -> None:
    aspect_ratio = pixel_width / pixel_height
    if not COIN_MIN_ASPECT_RATIO <= aspect_ratio <= COIN_MAX_ASPECT_RATIO:
        raise ScaleCalibrationError(
            "implausible_reference_shape",
            "Coin reference bbox must be approximately square. Please provide a tighter bbox around a visible coin.",
        )


def _validate_reference_not_food(
    reference_bbox: list[int],
    segments: list[dict[str, Any]],
) -> None:
    for segment in segments:
        segment_bbox = segment.get("bbox")
        if not isinstance(segment_bbox, list) or len(segment_bbox) != 4:
            continue

        iou = _bbox_iou(reference_bbox, [int(v) for v in segment_bbox])
        if iou > MAX_REFERENCE_FOOD_IOU:
            raise ScaleCalibrationError(
                "reference_overlaps_food",
                "Reference bbox overlaps a food segment too much. Choose a visible non-food reference object region.",
            )


def calculate_reference_scale(
    reference_object_type: str,
    bbox: list[int],
    image_width: int,
    image_height: int,
) -> ReferenceScale:
    normalized_type = reference_object_type.strip().lower()
    dimensions = get_reference_object_dimensions(normalized_type)
    clipped_bbox = _clip_bbox_to_image(bbox, image_width, image_height)
    pixel_width = clipped_bbox[2] - clipped_bbox[0]
    pixel_height = clipped_bbox[3] - clipped_bbox[1]

    if pixel_width < MIN_REFERENCE_PIXELS or pixel_height < MIN_REFERENCE_PIXELS:
        raise ScaleCalibrationError(
            "reference_too_small",
            "Reference object is too small in the image for reliable scale calibration.",
        )

    if normalized_type == "coin":
        _validate_coin_bbox_shape(pixel_width, pixel_height)

    reference_pixels, cm_per_pixel = _known_reference_pixels(
        normalized_type,
        dimensions,
        pixel_width,
        pixel_height,
    )
    if not MIN_CM_PER_PIXEL <= cm_per_pixel <= MAX_CM_PER_PIXEL:
        raise ScaleCalibrationError(
            "implausible_scale",
            "Reference object scale is physically implausible. Please re-scan with a clearer reference object.",
        )

    return ReferenceScale(
        type=normalized_type,
        bbox=clipped_bbox,
        known_size_cm=dimensions,
        pixel_width=pixel_width,
        pixel_height=pixel_height,
        reference_pixels=round(reference_pixels, 6),
        cm_per_pixel=round(cm_per_pixel, 6),
    )


def _estimate_segment_scale(segment: dict[str, Any], cm_per_pixel: float) -> dict[str, Any]:
    x_min, y_min, x_max, y_max = segment["bbox"]
    pixel_width = max(0, int(x_max) - int(x_min))
    pixel_height = max(0, int(y_max) - int(y_min))

    enriched_segment = dict(segment)
    enriched_segment["estimated_width_cm"] = round(pixel_width * cm_per_pixel, 6)
    enriched_segment["estimated_height_cm"] = round(pixel_height * cm_per_pixel, 6)
    enriched_segment["area_cm2"] = round(float(segment["area_pixels"]) * cm_per_pixel * cm_per_pixel, 6)
    return enriched_segment


def estimate_reference_scale(
    image_bytes: bytes,
    content_type: str | None,
    settings: Any,
    reference_object_type: str,
    reference_bbox: list[int] | None,
    confidence_threshold: float,
    max_segments: int,
    depth_estimator: Callable[..., dict[str, Any]] | None = None,
    reference_detector: Callable[..., list[int] | None] | None = None,
) -> dict[str, Any]:
    depth_estimate = (depth_estimator or estimate_food_depth)(
        image_bytes=image_bytes,
        content_type=content_type,
        settings=settings,
        confidence_threshold=confidence_threshold,
        max_segments=max_segments,
    )

    if depth_estimate["status"] != "depth_estimated":
        return {
            "status": "rejected",
            "reason": depth_estimate.get("reason", "depth_not_estimated"),
            "message": depth_estimate.get("message", "Depth estimation is required before scale calibration."),
            "image": depth_estimate.get("image"),
            "reference_object": None,
            "segments": [],
            "approximate": True,
        }

    image = depth_estimate["image"]
    bbox = reference_bbox
    if bbox is None and reference_detector is not None:
        bbox = reference_detector(
            image_bytes=image_bytes,
            content_type=content_type,
            reference_object_type=reference_object_type,
            image=image,
        )

    if bbox is None:
        raise ScaleCalibrationError(
            "missing_reference_object",
            "Reference object bounding box is required for scale calibration.",
        )

    reference_scale = calculate_reference_scale(
        reference_object_type,
        bbox,
        image_width=int(image["width"]),
        image_height=int(image["height"]),
    )
    _validate_reference_not_food(reference_scale.bbox, depth_estimate.get("segments", []))

    segments = [
        _estimate_segment_scale(segment, reference_scale.cm_per_pixel)
        for segment in depth_estimate["segments"]
    ]

    return {
        "status": "scale_estimated",
        "reason": None,
        "message": "Reference scale estimated for segmented food regions. Results are approximate.",
        "image": image,
        "reference_object": asdict(reference_scale),
        "segments": segments,
        "approximate": True,
    }
