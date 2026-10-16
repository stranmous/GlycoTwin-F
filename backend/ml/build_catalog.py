"""Build the curated Pakistani dish catalog v1 (WS2).

Reference per-100g values mapped from standard food-composition data
(USDA FoodData Central) to typical Pakistani preparations. Every profile
is data_class=provisional until the weighed-portion study verifies
local recipes; nothing here is labelled measured.
"""
import json
from pathlib import Path

OUT = Path(__file__).parents[1] / "app/modules/m5_nutrition/data/dish_catalog_v1.json"

PROV = {
    "source_ids": ["usda_fdc"],
    "transformation": "Reference per-100g values mapped from standard food-composition "
                      "data to the typical Pakistani preparation; local verification "
                      "pending the weighed-portion study.",
    "data_class": "provisional",
    "review_status": "not_reviewed",
    "reviewer": None,
    "reviewed_on": None,
}


def dish(did, en, ur, roman, aliases, category, kcal, carbs, protein, fat, fiber,
         density, unc=30, kind="dish", parent=None):
    return ({"id": did, "names": {"english": en, "urdu": ur, "roman_urdu": roman},
             "aliases": aliases, "category": category, "kind": kind,
             "parent_id": parent, "observation_mode": "either"},
            {"food_id": did,
             "nutrients_per_100g": {"calories_kcal": kcal, "carbs_g": carbs,
                                    "protein_g": protein, "fat_g": fat, "fiber_g": fiber},
             "density_g_per_ml": density,
             "preparation_assumptions": ["Typical home/restaurant preparation; oil quantity is the main variable."],
             "uncertainty": {"relative_percent": unc,
                             "variation_notes": ["Recipe-to-recipe variation is expected; values are reference estimates."]},
             "provenance": dict(PROV)})


D = [
    dish("biryani_generic", "Biryani", "بریانی", "biryani", ["biryani", "chicken biryani", "sindhi biryani"],
         "rice_dishes", 160, 22, 6, 5.5, 1.5, 0.75),
    dish("biryani_rice_visible", "Biryani rice", "بریانی چاول", "biryani chawal", ["biryani rice"],
         "rice_dishes", 140, 26, 3, 2.5, 0.6, 0.8, kind="component", parent="biryani_generic"),
    dish("biryani_potato_occluded", "Biryani potato", "بریانی آلو", "biryani aloo", ["biryani potato"],
         "rice_dishes", 90, 17, 2, 1.5, 2, 0.85, kind="component", parent="biryani_generic"),
    dish("pulao", "Pulao", "پلاؤ", "pulao", ["pulao", "yakhni pulao", "chicken pulao"],
         "rice_dishes", 140, 24, 4.5, 3, 0.8, 0.78),
    dish("cooked_rice", "Cooked rice", "چاول", "chawal", ["rice", "chawal", "boiled rice", "white rice"],
         "rice_dishes", 130, 28, 2.7, 0.3, 0.4, 0.8, unc=20),
    dish("chicken_karahi", "Chicken karahi", "چکن کڑاہی", "chicken karahi", ["karahi", "chicken karahi", "karahi gosht"],
         "curries", 165, 3, 14, 11, 0.8, 0.95),
    dish("chicken_curry_generic", "Chicken curry", "چکن سالن", "chicken salan", ["chicken curry", "salan", "chicken salan"],
         "curries", 150, 4, 13, 9, 1, 0.98),
    dish("chicken_handi", "Chicken handi", "چکن ہانڈی", "chicken handi", ["handi", "chicken handi"],
         "curries", 180, 4, 13, 12, 0.6, 0.97),
    dish("nihari", "Nihari", "نہاری", "nihari", ["nihari", "beef nihari"],
         "curries", 135, 4, 10, 9, 0.7, 0.98),
    dish("haleem", "Haleem", "حلیم", "haleem", ["haleem"],
         "curries", 115, 12, 7, 4.5, 2.5, 1.0),
    dish("keema", "Keema", "قیمہ", "keema", ["keema", "qeema", "mince", "beef keema"],
         "curries", 175, 3, 14, 12, 0.8, 0.95),
    dish("aloo_gosht", "Aloo gosht", "آلو گوشت", "aloo gosht", ["aloo gosht", "aloo gosht shorba"],
         "curries", 105, 8, 6, 5.5, 1.5, 0.97),
    dish("chicken_tikka", "Chicken tikka", "چکن ٹکا", "chicken tikka", ["tikka", "chicken tikka"],
         "grilled", 150, 2, 22, 6, 0.5, 0.85),
    dish("seekh_kebab", "Seekh kebab", "سیخ کباب", "seekh kebab", ["kebab", "seekh kebab", "kabab"],
         "grilled", 230, 3, 15, 17, 0.8, 0.9),
    dish("daal_generic", "Daal", "دال", "daal", ["daal", "dal", "lentils", "masoor daal", "daal chawal"],
         "lentils", 116, 20, 9, 0.5, 5, 0.95, unc=25),
    dish("chana_masala", "Chana masala", "چنا مسالہ", "chana masala", ["chana", "chana masala", "cholay", "chickpeas"],
         "lentils", 135, 19, 6, 4, 5, 0.95),
    dish("roti_generic", "Roti", "روٹی", "roti", ["roti", "chapati", "phulka"],
         "breads", 260, 49, 8, 3.5, 6, 0.55, unc=20),
    dish("naan", "Naan", "نان", "naan", ["naan", "roghni naan"],
         "breads", 305, 52, 8, 7, 2, 0.5, unc=20),
    dish("paratha", "Paratha", "پراٹھا", "paratha", ["paratha", "pratha"],
         "breads", 290, 38, 5, 13, 2.5, 0.55),
    dish("samosa", "Samosa", "سموسہ", "samosa", ["samosa", "aloo samosa"],
         "fried_snacks", 260, 28, 5, 14, 2.5, 0.6),
    dish("pakora", "Pakora", "پکوڑا", "pakora", ["pakora", "pakoday", "bhajia"],
         "fried_snacks", 275, 16, 6, 21, 3, 0.6),
    dish("mixed_sabzi", "Mixed sabzi", "سبزی", "sabzi", ["sabzi", "mixed vegetables", "sabzi salan"],
         "vegetables", 65, 8, 2, 3, 2.5, 0.85),
    dish("baingan_bharta", "Baingan bharta", "بینگن بھرتہ", "baingan bharta", ["baingan", "bharta", "baingan bharta"],
         "vegetables", 85, 7, 1.8, 5.5, 3, 0.9),
    dish("raita", "Raita", "رائتہ", "raita", ["raita", "dahi raita"],
         "dairy_sides", 62, 4.5, 3, 3.5, 0, 1.02, unc=20),
    dish("kheer", "Kheer", "کھیر", "kheer", ["kheer"],
         "desserts", 128, 20, 3.5, 3.8, 0.2, 1.05),
    dish("gulab_jamun", "Gulab jamun", "گلاب جامن", "gulab jamun", ["gulab jamun", "jamun"],
         "desserts", 380, 56, 5, 15, 0.5, 0.9),
    dish("chai", "Chai", "چائے", "chai", ["chai", "tea", "doodh patti", "chai doodh patti"],
         "drinks", 62, 9, 2, 2, 0, 1.0, unc=25),
    dish("lassi", "Lassi", "لسی", "lassi", ["lassi", "sweet lassi", "meethi lassi"],
         "drinks", 92, 13, 3, 3, 0, 1.03, unc=25),
]

payload = {
    "schema_version": "1.0",
    "data_version": "pakistan-curated-v1.0",
    "status": "provisional",
    "sources": [
        {"source_id": "usda_fdc", "title": "USDA FoodData Central",
         "publisher": "U.S. Department of Agriculture",
         "url": "https://fdc.nal.usda.gov/",
         "license": "public domain (CC0)", "commercial_use": "confirmed",
         "record_status": "approved", "accessed_on": "2026-10-10",
         "transformation": "Reference per-100g values for comparable dishes and ingredients; "
                           "Pakistani mixed dishes mapped to closest standard entries and "
                           "adjusted for typical recipes."},
        {"source_id": "pk_fct", "title": "Food Composition Table for Pakistan",
         "publisher": "FAO INFOODS / University of Agriculture Faisalabad",
         "url": "https://www.fao.org/infoods/infoods/en/",
         "license": "research use", "commercial_use": "unknown",
         "record_status": "candidate", "accessed_on": "2026-10-10",
         "transformation": "Regional cross-check source for local dishes; full extraction "
                           "pending the weighed-portion study."},
    ],
    "taxonomy": [t for t, _ in D],
    "nutrition_profiles": [p for _, p in D],
    "recipe_profiles": [],
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", OUT, "taxa:", len(D))
