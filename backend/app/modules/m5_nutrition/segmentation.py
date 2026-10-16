from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict, dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, UnidentifiedImageError

SUPPORTED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
DEFAULT_CONFIDENCE_THRESHOLD = 0.4
DEFAULT_MAX_SEGMENTS = 10


class ImageValidationError(ValueError):
    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason
        self.message = message


class SegmentationModelUnavailableError(RuntimeError):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


@dataclass(frozen=True)
class SegmentMetadata:
    id: int
    bbox: list[int]
    area_pixels: int
    confidence: float | None


def validate_image_upload(image_bytes: bytes, content_type: str | None) -> Image.Image:
    if content_type not in SUPPORTED_IMAGE_CONTENT_TYPES:
        raise ImageValidationError(
            "unsupported_image_type",
            "Please upload a JPEG, PNG, WebP, or BMP meal image.",
        )

    if not image_bytes:
        raise ImageValidationError("empty_image", "Please upload a non-empty meal image.")

    try:
        image = Image.open(BytesIO(image_bytes))
        image.verify()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageValidationError(
            "unreadable_image",
            "The uploaded image could not be read. Please re-upload a clearer meal photo.",
        ) from exc

    width, height = image.size
    if width < 64 or height < 64:
        raise ImageValidationError(
            "image_too_small",
            "The uploaded image is too small for reliable segmentation.",
        )

    return image


def _load_fastsam_model(model_path: Path) -> Any:
    if not model_path.exists():
        raise SegmentationModelUnavailableError(
            f"FastSAM model weights were not found at {model_path}. "
            "Place FastSAM-s.pt there or set FASTSAM_MODEL_PATH."
        )

    try:
        from ultralytics import FastSAM
    except ImportError as exc:
        raise SegmentationModelUnavailableError(
            "The ultralytics FastSAM runtime is not installed in this backend environment."
        ) from exc

    return FastSAM(str(model_path))


def _as_numpy_array(value: Any) -> np.ndarray:
    if hasattr(value, "detach"):
        value = value.detach()
    if hasattr(value, "cpu"):
        value = value.cpu()
    if hasattr(value, "numpy"):
        return value.numpy()
    return np.asarray(value)


def _extract_confidences(result: Any) -> list[float | None]:
    boxes = getattr(result, "boxes", None)
    confidences = getattr(boxes, "conf", None)
    if confidences is None:
        return []
    return [float(value) for value in _as_numpy_array(confidences).reshape(-1)]


def _bbox_from_mask(mask: np.ndarray) -> list[int]:
    y_indexes, x_indexes = np.where(mask)
    if not len(x_indexes) or not len(y_indexes):
        return [0, 0, 0, 0]
    return [
        int(x_indexes.min()),
        int(y_indexes.min()),
        int(x_indexes.max()) + 1,
        int(y_indexes.max()) + 1,
    ]


def _extract_segments_from_result(
    result: Any,
    confidence_threshold: float,
    max_segments: int,
) -> list[SegmentMetadata]:
    masks = getattr(result, "masks", None)
    mask_data = getattr(masks, "data", None)
    if mask_data is None:
        return []

    mask_array = _as_numpy_array(mask_data)
    if mask_array.ndim == 2:
        mask_array = mask_array[np.newaxis, :, :]

    confidences = _extract_confidences(result)
    segments: list[SegmentMetadata] = []
    for index, mask in enumerate(mask_array):
        confidence = confidences[index] if index < len(confidences) else None
        if confidence is not None and confidence < confidence_threshold:
            continue

        binary_mask = mask > 0.5
        area_pixels = int(binary_mask.sum())
        if area_pixels == 0:
            continue

        segments.append(
            SegmentMetadata(
                id=len(segments) + 1,
                bbox=_bbox_from_mask(binary_mask),
                area_pixels=area_pixels,
                confidence=confidence,
            )
        )
        if len(segments) >= max_segments:
            break

    return segments


def segment_food_image(
    image_bytes: bytes,
    content_type: str | None,
    settings: Any,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    max_segments: int = DEFAULT_MAX_SEGMENTS,
    model_factory: Callable[[Path], Any] | None = None,
) -> dict[str, Any]:
    image = validate_image_upload(image_bytes, content_type)
    model_loader = model_factory or _load_fastsam_model
    model = model_loader(settings.fastsam_model_path)

    results = model(
        image,
        device="cpu",
        retina_masks=True,
        conf=confidence_threshold,
        verbose=False,
    )
    first_result = results[0] if results else None
    segments = (
        _extract_segments_from_result(first_result, confidence_threshold, max_segments)
        if first_result is not None
        else []
    )

    width, height = image.size
    if not segments:
        return {
            "status": "rejected",
            "reason": "no_food_segments",
            "message": "No reliable food regions were found. Please re-upload a clearer meal photo.",
            "image": {"width": width, "height": height},
            "segments": [],
            "approximate": True,
        }

    return {
        "status": "segmented",
        "reason": None,
        "message": "Food segmentation completed. Results are approximate segmentation metadata only.",
        "image": {"width": width, "height": height},
        "segments": [asdict(segment) for segment in segments],
        "approximate": True,
    }
