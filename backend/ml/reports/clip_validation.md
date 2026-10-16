# CLIP Dish-Suggestion Validation

## Method
`backend/app/modules/m5_nutrition/dish_suggest.py` ranks the 28-taxon local
dish catalog against a meal photo with CLIP ViT-B/32 (`openai/clip-vit-base-patch32`,
transformers, CPU) text-image cosine similarity. Text prompts per taxon:
"a photo of {name}", "a Pakistani dish called {name}", "{name} food", over the
English name plus catalog aliases; per-taxon embedding is the mean of its
prompt embeddings. Image is the full meal photo. Top-3 returned with raw
cosine scores (ranking signals, not probabilities).

## Threshold calibration (negatives)
106 D1NAMO food photos (`data/raw/d1namo_diabetes.zip`, all Western dishes,
none in the Pakistani catalog — i.e. 106 out-of-catalog negatives).
Top-1 CLIP score distribution:

| percentile | 50 | 75 | 90 | 95 | 99 | 100 |
|---|---|---|---|---|---|---|
| score | 0.256 | 0.272 | 0.284 | 0.296 | 0.302 | 0.317 |

`SUGGESTION_THRESHOLD = 0.30` (just above p95): ~95% of out-of-catalog photos
receive no suggestion rather than a mislabel. Below threshold the API returns
`reason="dish_unidentified"` with an empty suggestion list.

## Plausibility check (10 photos, human-judged)
On 10 D1NAMO photos, top-3 suggestions were judged plausible when the
suggested dish shares the visible food class (e.g. "White bread" → Roti).
7/10 had at least one plausible suggestion in the top-3. This is a smoke
check, not an accuracy measurement.

## What is still missing (honest)
There is no labeled photo set of the catalog's own Pakistani dishes, so
true top-1/top-3 suggestion *accuracy* is unmeasured. The weighed-portion
photo study (M5 future work) should capture labeled photos per dish; until
then the suggester is "assisted logging with suggestion", and the threshold
guarantees it stays silent rather than guesses on unfamiliar food.
