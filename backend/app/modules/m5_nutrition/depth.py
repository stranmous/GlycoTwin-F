from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from app.modules.m5_nutrition.segmentation import segment_food_image, validate_image_upload


class DepthModelUnavailableError(RuntimeError):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class DepthEstimationError(RuntimeError):
    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason
        self.message = message


@dataclass(frozen=True)
class SegmentDepthSummary:
    id: int
    bbox: list[int]
    area_pixels: int
    confidence: float | None
    relative_depth_mean: float
    relative_depth_min: float
    relative_depth_max: float


class HuggingFaceDepthAnythingModel:
    def __init__(self, model_path: Path, device: str):
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation
        except ImportError as exc:
            raise DepthModelUnavailableError(
                "Depth Anything V2 requires torch and transformers in the backend environment."
            ) from exc

        self._torch = torch
        self._processor = AutoImageProcessor.from_pretrained(str(model_path), local_files_only=True)
        self._model = AutoModelForDepthEstimation.from_pretrained(str(model_path), local_files_only=True)
        self._device = device
        self._model.to(device)
        self._model.eval()

    def estimate(self, image: Image.Image) -> np.ndarray:
        inputs = self._processor(images=image, return_tensors="pt")
        inputs = {key: value.to(self._device) for key, value in inputs.items()}

        with self._torch.no_grad():
            outputs = self._model(**inputs)
            predicted_depth = outputs.predicted_depth
            prediction = self._torch.nn.functional.interpolate(
                predicted_depth.unsqueeze(1),
                size=(image.height, image.width),
                mode="bicubic",
                align_corners=False,
            ).squeeze()

        return prediction.detach().cpu().numpy()


def _load_depth_model(model_path: Path, device: str) -> HuggingFaceDepthAnythingModel:
    if not model_path.exists():
        raise DepthModelUnavailableError(
            f"Depth Anything V2 model files were not found at {model_path}. "
            "Place the local model directory there or set DEPTH_ANYTHING_MODEL_PATH."
        )

    return HuggingFaceDepthAnythingModel(model_path, device)


def normalize_relative_depth(depth_map: Any) -> np.ndarray:
    depth_array = np.asarray(depth_map, dtype=np.float32)
    if depth_array.ndim != 2:
        raise DepthEstimationError("invalid_depth_map", "Depth model output must be a 2D depth map.")

    finite_values = depth_array[np.isfinite(depth_array)]
    if finite_values.size == 0:
        raise DepthEstimationError("invalid_depth_map", "Depth model output did not contain finite values.")

    min_depth = float(finite_values.min())
    max_depth = float(finite_values.max())
    if max_depth == min_depth:
        return np.zeros_like(depth_array, dtype=np.float32)

    normalized = (depth_array - min_depth) / (max_depth - min_depth)
    return np.nan_to_num(normalized, nan=0.0, posinf=1.0, neginf=0.0).astype(np.float32)


def _clip_bbox(bbox: list[int], width: int, height: int) -> tuple[int, int, int, int] | None:
    if len(bbox) != 4:
        return None

    x_min = max(0, min(width, int(bbox[0])))
    y_min = max(0, min(height, int(bbox[1])))
    x_max = max(0, min(width, int(bbox[2])))
    y_max = max(0, min(height, int(bbox[3])))
    if x_max <= x_min or y_max <= y_min:
        return None

    return x_min, y_min, x_max, y_max


def summarize_segment_depths(
    segments: list[dict[str, Any]],
    relative_depth_map: np.ndarray,
) -> list[SegmentDepthSummary]:
    height, width = relative_depth_map.shape
    summaries: list[SegmentDepthSummary] = []

    for segment in segments:
        clipped_bbox = _clip_bbox(segment.get("bbox", []), width, height)
        if clipped_bbox is None:
            continue

        x_min, y_min, x_max, y_max = clipped_bbox
        segment_depth = relative_depth_map[y_min:y_max, x_min:x_max]
        if segment_depth.size == 0:
            continue

        summaries.append(
            SegmentDepthSummary(
                id=int(segment["id"]),
                bbox=[x_min, y_min, x_max, y_max],
                area_pixels=int(segment["area_pixels"]),
                confidence=segment.get("confidence"),
                relative_depth_mean=round(float(segment_depth.mean()), 6),
                relative_depth_min=round(float(segment_depth.min()), 6),
                relative_depth_max=round(float(segment_depth.max()), 6),
            )
        )

    return summaries


def estimate_food_depth(
    image_bytes: bytes,
    content_type: str | None,
    settings: Any,
    confidence_threshold: float,
    max_segments: int,
    segmenter: Callable[..., dict[str, Any]] | None = None,
    depth_model_factory: Callable[[Path, str], Any] | None = None,
) -> dict[str, Any]:
    image = validate_image_upload(image_bytes, content_type)
    segment_image = segmenter or segment_food_image
    segmentation = segment_image(
        image_bytes=image_bytes,
        content_type=content_type,
        settings=settings,
        confidence_threshold=confidence_threshold,
        max_segments=max_segments,
    )

    if segmentation["status"] != "segmented":
        return {
            "status": "rejected",
            "reason": segmentation.get("reason", "no_food_segments"),
            "message": segmentation.get(
                "message",
                "No reliable food regions were found for depth estimation.",
            ),
            "image": segmentation.get("image") or {"width": image.width, "height": image.height},
            "segments": [],
            "approximate": True,
        }

    model_loader = depth_model_factory or _load_depth_model
    depth_model = model_loader(settings.depth_anything_model_path, settings.depth_model_device)
    relative_depth_map = normalize_relative_depth(depth_model.estimate(image))
    segment_summaries = summarize_segment_depths(segmentation["segments"], relative_depth_map)

    if not segment_summaries:
        return {
            "status": "rejected",
            "reason": "no_segment_depth",
            "message": "Depth was estimated, but no food segment had usable depth coverage.",
            "image": {"width": image.width, "height": image.height},
            "segments": [],
            "approximate": True,
        }

    return {
        "status": "depth_estimated",
        "reason": None,
        "message": "Relative depth estimated for segmented food regions. Results are approximate.",
        "image": {"width": image.width, "height": image.height},
        "segments": [asdict(summary) for summary in segment_summaries],
        "approximate": True,
    }
