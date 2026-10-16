"""Convert Shanghai T2DM files to the M1 loader's CSV format.

    python -m ml.convert_shanghai \\
        --src ../data/raw/shanghai_t2dm.zip \\
        --out ../data/processed/shanghai

Input: one .xls/.xlsx per patient (109 files) with columns:
  Date | CGM (mg/dl) | CBG | Blood Ketone | Dietary intake | 饮食 |
  Insulin dose - s.c. | Non-insulin hypoglycemic agents |
  CSII - bolus insulin (Novolin R, IU) | CSII - basal insulin (IU/H) |
  Insulin dose - i.v.

Dietary intake lines look like "Rice 150 g" (real weighed grams — the
strongest meal data of any dataset in this project). Carb grams are
ESTIMATED from a documented food->carb-factor table (standard nutrition
reference values, e.g. cooked rice ~0.28 g carbs per g). Every meal row is
flagged carbs_estimated=true; foods with no mapping use a documented
category fallback and are counted in the run report.

Provenance: files provided by the user (Arsalan) 2026-10-11 as
diabetes_datasets.zip; this is a T2DM cohort (the population the project
targets). Use is for local benchmarking; confirm the sharing terms with
Dr. Basit Raza before any external publication.
"""
from __future__ import annotations

import argparse
import csv
import re
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Carb factors (g carbs per g of food), from standard nutrition reference
# values (USDA FoodData Central magnitudes for cooked/common preparations).
# These are ESTIMATES, not measurements — every meal using them is flagged.
# ---------------------------------------------------------------------------
CARB_FACTORS: dict[str, float] = {
    # staples
    "rice": 0.28, "fried rice": 0.28, "coarse grain": 0.25,
    "coarase grain": 0.25, "buckwheat bread": 0.45, "bread": 0.49,
    "steamed bread": 0.45, "coarse grain steamed bread": 0.42,
    "steamed corn bun": 0.40, "buckwheat noodles": 0.25, "noodles": 0.25,
    "instant noodles": 0.55, "rice cake": 0.60, "steamed bun": 0.45,
    "pan fried bun": 0.45, "puff pastry": 0.45, "biscuit": 0.65,
    "corn": 0.21, "sweet potato": 0.20, "potato": 0.17, "taro": 0.27,
    "yam": 0.28,
    # vegetables (mostly water/fibre)
    "vegetable": 0.04, "boiled vegetable": 0.04, "fried vegetable": 0.05,
    "cabbage": 0.04, "hangzhou cabbage": 0.04, "chinese cabbage": 0.03,
    "lettuce": 0.03, "leaf lettuce": 0.03, "crown daisy": 0.03,
    "spinach": 0.02, "cucumber": 0.03, "radish": 0.04, "raddish": 0.04,
    "sliced lotus root": 0.17, "bean sprout": 0.04, "celery": 0.03,
    "zucchini": 0.03, "cauliflower": 0.04, "broccoli": 0.04,
    "sweet potato leaves": 0.04, "black fungus": 0.03, "fungus": 0.03,
    "onion": 0.09, "carrot": 0.10, "tomato": 0.04,
    # protein (negligible carbs)
    "egg": 0.01, "boiled egg": 0.01, "fried egg": 0.01, "duck egg": 0.01,
    "steamed egg": 0.01, "scrambled egg with tomato": 0.03,
    "chicken": 0.01, "chicken leg": 0.01, "chicken nugget": 0.08,
    "duck leg": 0.01, "pork": 0.01, "beef": 0.01, "mutton": 0.01,
    "fish": 0.01, "smoked fish": 0.01, "steamed fish": 0.01,
    "shrimp": 0.01, "boiled shrimp": 0.01, "crab": 0.01,
    "bullfrog": 0.01, "pig feet": 0.01, "luncheon meat": 0.03,
    "tofu": 0.02, "steamed bean curd roll": 0.05,
    # fruit / dairy
    "apple": 0.14, "kiwi fruit": 0.15, "banana": 0.23, "orange": 0.12,
    "milk": 0.05, "soybean milk": 0.04,
    # soups / porridge
    "porridge": 0.10, "fungus porridge": 0.08,
    "red bean and red date soup": 0.12, "soup": 0.06,
    # mixed dishes (best-effort averages)
    "dumpling": 0.35, "wonton": 0.30, "spring roll": 0.30,
    "meal replacement powder": 0.50, "rice wine": 0.05,
    # second pass (from fallback audit)
    "pigeon": 0.01,
    "roasted pigeon": 0.01, "hairtail": 0.01, "steamed hairtail": 0.01,
    "yellow croaker": 0.01, "steamed yellow croaker": 0.01,
    "pomfret": 0.01, "steamed pomfret": 0.01, "abalone": 0.02,
    "black carp": 0.01, "bream": 0.01, "steame bream": 0.01,
    "green pepper": 0.04, "braised radish": 0.05,
    "sliced radish": 0.04, "black fungus with vinegar": 0.03,
    "asparagus": 0.03, "fried asparagus": 0.04, "kelp": 0.02,
    "garlic": 0.10, "needle mushroom": 0.03, "sword bean": 0.15,
    "broad bean": 0.20, "coffee": 0.01, "latte coffee": 0.05,
    "croissants": 0.45, "deep-fried dough stick": 0.45, "pancake": 0.35,
    "pretzel": 0.60, "protein powder": 0.10, "wax gourd": 0.03,
    "red bean and red date": 0.20,
}
# Category fallbacks when no exact food match exists (documented, counted).
CATEGORY_FALLBACKS: list[tuple[str, float]] = [
    ("rice", 0.28), ("noodle", 0.25), ("bread", 0.45), ("bun", 0.45),
    ("dumpling", 0.35), ("wonton", 0.30), ("porridge", 0.10),
    ("soup", 0.06), ("vegetable", 0.04), ("cabbage", 0.04),
    ("lettuce", 0.03), ("spinach", 0.02), ("cucumber", 0.03),
    ("egg", 0.01), ("pork", 0.01), ("beef", 0.01), ("chicken", 0.01),
    ("mutton", 0.01), ("duck", 0.01), ("fish", 0.01), ("shrimp", 0.01),
    ("crab", 0.01), ("tofu", 0.02), ("bean curd", 0.03), ("milk", 0.05),
    ("fruit", 0.12), ("apple", 0.14), ("meat", 0.01), ("coffee", 0.02),
    ("mushroom", 0.03), ("fungus", 0.03), ("pepper", 0.04),
]
FALLBACK_CARBS = 0.10  # last resort for unmapped foods (counted, documented)

FOOD_RE = re.compile(
    r"\s*([A-Za-z][A-Za-z .'/()\-]*?)\s+([\d.]+)\s*(g|ml)?\s*$")
IU_RE = re.compile(r"([\d.]+)\s*IU")


def carb_factor(food: str) -> tuple[float, str]:
    """(factor, method): exact | category | fallback."""
    f = food.lower().strip()
    if f in CARB_FACTORS:
        return CARB_FACTORS[f], "exact"
    for cat, fac in CATEGORY_FALLBACKS:
        if cat in f:
            return fac, "category"
    return FALLBACK_CARBS, "fallback"


def parse_diet(diet: str) -> list[tuple[str, float, float, str]]:
    """Dietary intake text -> [(food, grams, carbs_g, method)]."""
    items = []
    for line in str(diet).split("\n"):
        line = line.strip()
        if not line or "not available" in line.lower():
            continue
        m = FOOD_RE.match(line)
        if not m:
            continue
        food, qty, unit = m.group(1).strip(), float(m.group(2)), m.group(3)
        # ml treated as grams (density ~1 for milk/soy milk); bare numbers
        # (unit None) are taken as grams and counted via the fallback audit
        assert unit in ("g", "ml", None)
        grams = qty
        factor, method = carb_factor(food)
        items.append((food, grams, grams * factor, method))
    return items


def parse_sc_insulin(text: str) -> float:
    """'Gansulin 40R, 6 IU' -> 6.0."""
    m = IU_RE.search(str(text))
    return float(m.group(1)) if m else 0.0


def iter_patient_rows(src: Path):
    """Yield (datetime, cgm, diet, sc, bolus, basal, iv) for one file."""
    name = src.name.lower()
    if name.endswith(".xlsx"):
        import openpyxl
        wb = openpyxl.load_workbook(src, read_only=True)
        ws = wb.active
        for row in ws.iter_rows(min_row=2, values_only=True):
            dt = row[0]
            if not isinstance(dt, datetime):
                continue
            yield (dt, row[1], row[4], row[6], row[8], row[9], row[10])
    else:
        import xlrd
        bk = xlrd.open_workbook(src)
        sh = bk.sheet_by_index(0)
        for r in range(1, sh.nrows):
            cell = sh.cell(r, 0)
            try:
                if cell.ctype == xlrd.XL_CELL_DATE:
                    dt = xlrd.xldate_as_datetime(cell.value, bk.datemode)
                else:
                    dt = datetime.fromisoformat(str(cell.value))
            except (ValueError, TypeError):
                continue
            yield (dt, sh.cell_value(r, 1) or None, sh.cell_value(r, 4) or None,
                   sh.cell_value(r, 6) or None, sh.cell_value(r, 8) or None,
                   sh.cell_value(r, 9) or None, sh.cell_value(r, 10) or None)


def convert_file(src: Path, dst: Path, stats: Counter) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    cgm_rows, meal_rows, ins_rows = [], [], []
    for dt, cgm, diet, sc, bolus, basal, iv in iter_patient_rows(src):
        ts = dt.strftime("%Y-%m-%d %H:%M:%S")
        if cgm not in (None, ""):
            try:
                g = float(cgm)
            except (ValueError, TypeError):
                g = None
            if g is not None and 20.0 <= g <= 600.0:
                cgm_rows.append((ts, round(g, 1)))
        if diet and "not available" not in str(diet).lower():
            items = parse_diet(diet)
            if items:
                carbs = sum(c for _, _, c, _ in items)
                for _, _, _, method in items:
                    stats[f"carb_method_{method}"] += 1
                name = "; ".join(f for f, _, _, _ in items)[:200]
                meal_rows.append((ts, round(carbs, 1), name))
                stats["meals"] += 1
        sc_u = parse_sc_insulin(sc) if sc else 0.0
        if sc_u > 0:
            ins_rows.append((ts, sc_u, "bolus"))
            stats["insulin_bolus"] += 1
        for val, kind in ((bolus, "bolus"), (basal, "basal"), (iv, "iv")):
            if val not in (None, ""):
                try:
                    u = float(val)
                except (ValueError, TypeError):
                    continue
                if u > 0:
                    ins_rows.append((ts, u, kind))
                    stats[f"insulin_{kind}"] += 1
    with open(dst / "cgm.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "glucose"])
        w.writerows(cgm_rows)
    with open(dst / "meals.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "carbohydrates_g", "carbs_g_est",
                    "carbs_estimated", "protein_g", "fat_g", "fiber_g",
                    "meal_type", "name"])
        for ts, carbs, name in meal_rows:
            w.writerow([ts, carbs, carbs, "true", 0.0, 0.0, 0.0,
                        "meal", name])
    with open(dst / "insulin.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "units", "kind"])
        w.writerows(ins_rows)
    stats["patients"] += 1
    stats["cgm_points"] += len(cgm_rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, required=True,
                    help="shanghai_t2dm.zip (or extracted dir)")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    src = args.src
    if src.suffix == ".zip":
        tmp = Path("/tmp/shanghai_extract")
        with zipfile.ZipFile(src) as z:
            z.extractall(tmp)
        # The zip also carries Shanghai_T1DM — only take the T2DM cohort.
        t2dm = tmp / "Shanghai_T2DM"
        base = t2dm if t2dm.is_dir() else tmp
        files = sorted(base.rglob("*.xlsx")) + sorted(
            f for f in base.rglob("*.xls") if not f.name.endswith(".xlsx"))
    else:
        files = sorted(src.glob("*.xlsx")) + sorted(
            f for f in src.glob("*.xls") if not f.name.endswith(".xlsx"))

    stats: Counter = Counter()
    for f in files:
        pid = f.stem  # e.g. 2000_0_20201230
        convert_file(f, args.out / pid, stats)

    print(f"patients: {stats['patients']}")
    print(f"cgm points: {stats['cgm_points']}")
    print(f"meals: {stats['meals']}")
    print(f"insulin: bolus={stats['insulin_bolus']} basal={stats['insulin_basal']} "
          f"iv={stats['insulin_iv']}")
    print(f"carb methods: exact={stats['carb_method_exact']} "
          f"category={stats['carb_method_category']} "
          f"fallback={stats['carb_method_fallback']}")


if __name__ == "__main__":
    main()
