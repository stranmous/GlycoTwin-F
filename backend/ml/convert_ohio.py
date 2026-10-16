"""Convert OhioT1DM XML files to the M1 loader's CSV format (WS1).

    python -m ml.convert_ohio \
        --src ../data/raw/ohio_kaggle/ohiot1dm_kaggle \
        --out ../data/processed/ohiot1dm

Input: <pid>-ws-training.xml files in the official OhioT1DM layout
(glucose_level/event[@ts,@value] in mg/dL at 5-min cadence, meal/event
with real carbohydrate grams). The -testing files are ignored here; the
benchmark splits by patient, not by the organizers' temporal split, so
training+testing files of *test* patients stay untouched until held out.

Provenance note: this working copy reached us as a Kaggle re-upload (uploaded by
the user 2026-10-10); the team holds a data-use agreement for OhioT1DM, under
which this benchmarking use is covered. The report cites the official release
(Marling & Bunescu, Ohio University).
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

from app.modules.m1_ingestion.loaders.ohio_t1dm_loader import OhioT1DMLoader


def convert_file(xml_path: Path, dst: Path) -> tuple[int, int]:
    user = OhioT1DMLoader.load_xml(xml_path)
    dst.mkdir(parents=True, exist_ok=True)
    with open(dst / "cgm.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "glucose_mg_dl"])
        for r in user.cgm_readings:
            w.writerow([r.timestamp.isoformat(), r.glucose_mg_dl])
    with open(dst / "meals.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "carbohydrates_g", "protein_g", "fat_g"])
        for m in user.meal_records:
            w.writerow([m.timestamp.isoformat(), m.carbohydrates_g,
                        m.protein_g or 0.0, m.fat_g or 0.0])
    with open(dst / "insulin.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "units", "kind"])
        for d in user.insulin_doses:
            w.writerow([d.timestamp.isoformat(), d.units, d.kind])
    return len(user.cgm_readings), len(user.meal_records)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    for xml_path in sorted(args.src.glob("*-ws-training.xml")):
        pid = xml_path.name.split("-")[0]
        n_g, n_m = convert_file(xml_path, args.out / pid)
        print(f"{pid}: {n_g} CGM readings, {n_m} meals")


if __name__ == "__main__":
    main()
