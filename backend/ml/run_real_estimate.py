"""WS2 proof: run the M5 staged pipeline in real 'models' vision mode on a
real meal photo (curated catalog + FastSAM + Depth Anything V2, CPU).

    FASTSAM_MODEL_PATH=weights/FastSAM-s.pt \
    python -m ml.run_real_estimate --photo <meal.jpg> --dish-hint biryani

Integration proof only: volume accuracy still awaits the weighed-portion
study (scale needs a reference object in frame; D1NAMO photos have none).
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photo", type=Path, required=True)
    ap.add_argument("--dish-hint", default=None)
    args = ap.parse_args()

    from app.modules.m5_nutrition.service import run_estimate, vision_mode

    print("vision_mode:", vision_mode())
    data = args.photo.read_bytes()
    t0 = time.perf_counter()
    result = run_estimate(data, "image/jpeg", dish_hint=args.dish_hint)
    print(f"elapsed: {time.perf_counter() - t0:.1f}s")
    print(json.dumps(result, indent=1, default=str)[:3000])


if __name__ == "__main__":
    main()
