"""Deterministic meal vision stub.

Returns plausible South-Asian meal detections so the mobile UX is honest.
Real CV model is a v2 swap behind this same interface.
"""
from __future__ import annotations
import hashlib
from dataclasses import dataclass


@dataclass
class DetectedFoodDTO:
    name_en: str
    name_ur: str
    portion_g: float
    carbs_g: float
    kcal: float
    confidence: float


_FOOD_LIBRARY: list[DetectedFoodDTO] = [
    DetectedFoodDTO("Basmati rice", "چاول", 180, 56, 240, 0.86),
    DetectedFoodDTO("Chicken karahi", "چکن کڑاہی", 220, 9, 410, 0.81),
    DetectedFoodDTO("Daal chana", "دال چنا", 160, 28, 200, 0.78),
    DetectedFoodDTO("Roti", "روٹی", 60, 30, 160, 0.91),
    DetectedFoodDTO("Aloo gosht", "آلو گوشت", 240, 22, 380, 0.74),
    DetectedFoodDTO("Salad", "سلاد", 80, 6, 30, 0.69),
    DetectedFoodDTO("Yogurt raita", "رائتہ", 100, 7, 70, 0.72),
    DetectedFoodDTO("Mango", "آم", 150, 28, 110, 0.88),
    DetectedFoodDTO("Chai (with sugar)", "چائے", 220, 14, 90, 0.83),
]


def detect_foods(image_bytes: bytes) -> list[DetectedFoodDTO]:
    # Deterministic pick driven by image hash so the same image always yields same results.
    digest = hashlib.sha256(image_bytes or b"empty").digest()
    seed = digest[0]
    count = 2 + (digest[1] % 3)  # 2..4 items
    items: list[DetectedFoodDTO] = []
    for i in range(count):
        items.append(_FOOD_LIBRARY[(seed + i * 3) % len(_FOOD_LIBRARY)])
    return items
