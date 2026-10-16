"""Convert the D1NAMO diabetes subset to the M1 loader's CSV format (WS1).

    python -m ml.convert_d1namo \
        --src ../data/raw/d1namo_csv/diabetes_subset_pictures-glucose-food-insulin \
        --out ../data/processed/d1namo

Source facts (verified from the files, dataset CC BY-SA 4.0, Zenodo 5651217,
md5 104a2810050e2c6a6be698f683d862b5):
  - glucose.csv: mmol/L CGM at ~5-min cadence -> converted to mg/dL (x18);
    manual finger-stick rows are skipped (sparse, different noise profile).
  - food.csv: timestamp + free-text description + CALORIES ONLY. The
    dataset publishes no gram macros, so carbohydrate grams are estimated
    from calories with a fixed energy split (45% carbs / 20% protein /
    35% fat) unless the description is clearly very-low-carb (salad /
    lettuce / oil), in which case 15% carbs is used. This estimation is a
    documented dataset limitation; it is recorded in the training card and
    benchmark report, and it is one reason OhioT1DM (which logs grams) is
    the stronger second dataset.
  - insulin.csv exists but M2/M3 do not consume dose logs, so it is unused.
  - insulin.csv: date,time,fast_insulin,slow_insulin dose events -> copied
    verbatim to the processed dir so the ML pipeline can model exogenous
    (bolus) insulin instead of pretending T1D patients run on endogenous
    insulin alone.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path

LOW_CARB_HINTS = ("salad", "lettuce", "olive oil", "vinegar", "cucumber")


def _carb_fraction(description: str) -> float:
    d = description.lower()
    if any(h in d for h in LOW_CARB_HINTS) and "rice" not in d and "bread" not in d \
            and "pizza" not in d and "potato" not in d:
        return 0.15
    return 0.45


def convert_patient(src: Path, dst: Path) -> tuple[int, int]:
    dst.mkdir(parents=True, exist_ok=True)
    n_g = n_m = 0
    with open(src / "glucose.csv", newline="", encoding="utf-8") as f, \
            open(dst / "cgm.csv", "w", newline="", encoding="utf-8") as out:
        w = csv.writer(out)
        w.writerow(["timestamp", "glucose_mg_dl"])
        for row in csv.DictReader(f):
            if row.get("type", "cgm") != "cgm":
                continue
            ts = datetime.strptime(f"{row['date']} {row['time']}", "%Y-%m-%d %H:%M:%S")
            w.writerow([ts.isoformat(), round(float(row["glucose"]) * 18.0, 1)])
            n_g += 1
    food = src / "food.csv"
    if food.exists():
        with open(food, newline="", encoding="utf-8") as f, \
                open(dst / "meals.csv", "w", newline="", encoding="utf-8") as out:
            w = csv.writer(out)
            w.writerow(["timestamp", "carbohydrates_g", "protein_g", "fat_g"])
            for row in csv.DictReader(f):
                try:
                    ts = datetime.strptime(row["datetime"], "%Y:%m:%d %H:%M:%S")
                    kcal = float(row["calories"])
                except (ValueError, TypeError):
                    continue  # dataset rows with datetime="NA" / no calories
                carbs = kcal * _carb_fraction(row["description"]) / 4.0
                protein = kcal * 0.20 / 4.0
                fat = kcal * 0.35 / 9.0
                w.writerow([ts.isoformat(), round(carbs, 1), round(protein, 1), round(fat, 1)])
                n_m += 1
    # insulin doses pass through verbatim (fast/slow columns preserved)
    ins = src / "insulin.csv"
    if ins.exists():
        import shutil
        shutil.copyfile(ins, dst / "insulin.csv")
    return n_g, n_m


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    for patient in sorted(p for p in args.src.iterdir() if p.is_dir()):
        n_g, n_m = convert_patient(patient, args.out / patient.name)
        print(f"{patient.name}: {n_g} CGM readings, {n_m} meals")


if __name__ == "__main__":
    main()
