"""M5 vision probe (WS2): CPU latency of the real FastSAM + Depth Anything
V2 weights on real meal photographs.

    python -m ml.vision_probe --photos <dir> --reports ml/reports

This measures *timing only*. Segmentation/depth accuracy is meaningless
without weighed-portion ground truth; that study is Arsalan's kitchen-scale
session, and until it runs the pipeline keeps its fixture label.
"""
from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path


def pct(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, int(q * len(values)))]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photos", type=Path, required=True)
    ap.add_argument("--reports", type=Path, default=Path("ml/reports"))
    ap.add_argument("--fastsam", default="FastSAM-s.pt")
    ap.add_argument("--depth-model", default="depth-anything/Depth-Anything-V2-Small-hf")
    args = ap.parse_args()

    photos = sorted(args.photos.rglob("*.jpg")) + sorted(args.photos.rglob("*.png"))
    if not photos:
        raise SystemExit(f"no images under {args.photos}")

    from PIL import Image
    from transformers import pipeline as hf_pipeline
    from ultralytics import FastSAM

    report: dict = {"photos": [str(p) for p in photos], "n_photos": len(photos)}

    t0 = time.perf_counter()
    seg = FastSAM(args.fastsam)
    report["fastsam_load_s"] = round(time.perf_counter() - t0, 1)
    lat, masks = [], []
    for p in photos:
        t0 = time.perf_counter()
        results = seg(str(p), verbose=False)
        lat.append((time.perf_counter() - t0) * 1000)
        masks.append(len(results[0].masks) if results and results[0].masks is not None else 0)
    report["fastsam"] = {"model": args.fastsam,
                         "latency_ms_mean": round(statistics.mean(lat), 1),
                         "latency_ms_p95": round(pct(lat, 0.95), 1),
                         "masks_per_image": masks}

    t0 = time.perf_counter()
    depth = hf_pipeline("depth-estimation", model=args.depth_model)
    report["depth_load_s"] = round(time.perf_counter() - t0, 1)
    lat = []
    for p in photos:
        img = Image.open(p).convert("RGB")
        t0 = time.perf_counter()
        out = depth(img)
        lat.append((time.perf_counter() - t0) * 1000)
        assert out["depth"] is not None
    report["depth"] = {"model": args.depth_model,
                       "latency_ms_mean": round(statistics.mean(lat), 1),
                       "latency_ms_p95": round(pct(lat, 0.95), 1)}

    args.reports.mkdir(parents=True, exist_ok=True)
    (args.reports / "vision_probe.json").write_text(json.dumps(report, indent=2))
    md = ["# M5 vision probe (CPU, real D1NAMO meal photos)", "",
          (f"Photos: {report['n_photos']} · FastSAM load {report['fastsam_load_s']}s · "
          f"Depth load {report['depth_load_s']}s"), "",
          "| model | mean ms | p95 ms |", "|---|---|---|",
          f"| {args.fastsam} | {report['fastsam']['latency_ms_mean']} | {report['fastsam']['latency_ms_p95']} |",
          f"| Depth Anything V2 Small | {report['depth']['latency_ms_mean']} | {report['depth']['latency_ms_p95']} |",
          "", f"Masks per image: {masks}", "",
          "Timing only — no accuracy claim until the weighed-portion benchmark."]
    (args.reports / "vision_probe.md").write_text("\n".join(md) + "\n")
    print("\n".join(md))


if __name__ == "__main__":
    main()
