# GlycoTwin Technical Handoff

## Scope and Repositories

GlycoTwin is split across two local repositories:

| Repository | Path | Responsibility |
| --- | --- | --- |
| Mobile frontend | `C:\Users\Waqas\Documents\GlycoTwin-2` | Expo app, UI, Gemini coach client flow, M5 upload/result/manual-log UI |
| M1-M8 backend | `C:\Users\Waqas\Documents\arsalan_backend` | FastAPI API, JWT auth, M1-M8 services, M5 vision/nutrition pipeline |

The mobile client uses `EXPO_PUBLIC_API_URL` and calls the separate backend.
There is older `apps/api` code in the mobile repository, but the active M1-M8
integration discussed here is `arsalan_backend`, not that legacy API.

## Current Local Startup

Backend:

```powershell
cd C:\Users\Waqas\Documents\arsalan_backend\backend
uv sync --extra ml
$env:FASTSAM_MODEL_PATH = 'weights/FastSAM-s.pt'
uv run uvicorn app.main:app --port 8000 --reload
```

Mobile web app:

```powershell
cd C:\Users\Waqas\Documents\GlycoTwin-2
pnpm --filter @glycotwin/mobile start --web --port 8081
```

Health check for M5:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/nutrition/status
```

Expected output includes `"vision_mode":"models"`. `fixture` means no real
vision estimate may be displayed.

## M5 Design and Request Flow

M5 is an assisted nutrition workflow, not a general-purpose nutrition oracle.

1. The mobile scanner creates multipart form data and posts the image to
   `POST /api/v1/nutrition/estimate`.
2. It sends `dish_hint` when the user typed or confirmed a dish.
3. The backend validates the image, runs FastSAM segmentation and Depth
   Anything V2, estimates scale/volume/mass, then applies a local nutrition
   catalog profile.
4. If no confirmed catalog dish exists, CLIP ranks catalog candidates and the
   backend returns `status: rejected`, `reason: dish_suggestion`, plus
   `dish_suggestions`. This is deliberate: suggestions require confirmation.
5. If the model estimates an implausible portion, the backend returns
   `reason: portion_implausible` with no macro values.
6. The result screen offers manual logging for all rejected outcomes. Manual
   logs are sent to `POST /api/v1/ingestion/meal`.

The client awaits the upload request. There is no client-side timeout that
caused the prior instant rejection.

## Verified Runtime State

The following was tested locally on 2026-10-16:

- `GET /api/v1/nutrition/status` returned `vision_mode: models`.
- FastSAM and Depth Anything stages ran successfully for `A:\Downloads\food.jpg`.
- The image was recognized by the CLIP ranker as `Fried eggs` after that dish
  was added to the local catalog.
- The same image, confirmed as `anda fry`, produced a 1,711 g estimated mass.
  This is implausible for the pictured meal, so the backend now rejects it
  instead of displaying a misleading 3,354 kcal result.
- `uv run --with pytest python -m pytest tests/test_m5_pipeline.py -q` passed:
  19 tests.
- `pnpm --filter @glycotwin/mobile typecheck` passed.

## Changes Made During This Investigation

### Mobile frontend

- `apps/mobile/app/scan/camera.tsx`
  - Web/gallery-capable scanner now has a dish-hint field.
  - The scan screen communicates that model analysis can take time.
  - The original local image URI is preserved when navigating to results. This
    allows a suggested dish to be confirmed and resubmitted.

- `apps/mobile/app/scan/result.tsx`
  - Rejected M5 results already offered manual meal logging.
  - CLIP dish suggestions are now interactive. Selecting one resubmits the
    original image with the selected `dish_hint`.
  - If a confirmed estimate remains implausible, the existing manual flow is
    the correct fallback.

- `apps/mobile/src/locales/en.json` and `ur.json`
  - Added scanner and suggested-dish strings.

### Backend M5

- `backend/app/modules/m5_nutrition/data/dish_catalog_v1.json`
  - Added provisional `fried_eggs` / `anda fry` profile with broad 45 percent
    uncertainty and USDA FoodData Central provenance.
  - This is a generic fried-egg profile, not a local recipe validation.

- `backend/app/modules/m5_nutrition/pipeline.py`
  - Estimates above 1,500 g now return `portion_implausible` with null macro
    values instead of a numeric estimate.

- `backend/tests/test_m5_pipeline.py`
  - Added a regression test for `anda fry` catalog resolution.

## Current Known Problems

### P0: M5 is not ready to claim reliable phone-photo nutrition

Fact: the egg image produced a 1,711 g portion estimate without a reference
object. This was rejected safely, but it demonstrates that current FastSAM +
Depth Anything geometry is not sufficiently calibrated for arbitrary phone
photos.

Required next work:

- Collect weighed meal-photo data for representative Pakistani dishes.
- Evaluate segmentation quality independently from volume/mass accuracy.
- Calibrate scale and volume against the data, including plate-only and
  coin-reference scenarios.
- Establish dish-specific acceptance thresholds and regression benchmarks.
- Keep manual logging as a first-class route until the benchmark supports
  stronger claims.

### P1: Model setup has two backend defects

Fact: `backend/app/core/config.py` defaults to `weights/FastSAM-x.pt`, while
`scripts/fetch_weights.py` downloads `FastSAM-s.pt`. The environment variable
in the startup command is currently required.

Fact: `scripts/fetch_weights.py` requests obsolete CLIP filenames
(`processor_config.json` and `model.safetensors`). The current Hugging Face
model provides `preprocessor_config.json` and `pytorch_model.bin` instead.

Required next work:

- Align the default FastSAM configuration with the downloaded model.
- Correct the CLIP download file list and verify it on a clean checkout.
- Add a startup preflight that reports missing/incomplete weights clearly.
- Avoid `--reload` watching the virtual environment, because package writes
  cause unnecessary model reloads.

### P1: Catalog coverage is intentionally small

Fact: prior to this handoff, the active catalog had 28 Pakistani entries and
no egg profile. The current profile raises it to 29 entries.

Implication: an uploaded food can be visually recognizable yet still be
rejected if there is no nutrition profile. This is correct behavior; the app
must not substitute made-up macros.

Required next work:

- Expand the catalog with evidence-backed profiles and aliases.
- Record source, preparation assumptions, density, uncertainty, and review
  state for every profile.
- Add catalog coverage tests for the products/dishes in the product scope.

### P2: Suggested-dish retry needs local image availability

Fact: the new result-screen confirmation can resubmit an image only when the
route retains its local URI. Older result routes that stored only `/uploads/...`
cannot retry and ask the user to select the image again.

Required next work:

- Store an authenticated or otherwise retrievable original upload reference if
  retrying from history is a product requirement.
- Add an end-to-end Expo web and Android test for upload -> suggestion ->
  confirmation -> manual fallback.

### P2: Manual results are not automatically calculated from the image

Fact: this is intentional. Manual logging asks the user to enter macros rather
than pretending the image model generated them. It is the correct fallback for
unsupported dishes and untrustworthy portions.

Potential product improvement:

- Let users enter a serving count or weight and optionally prefill a clearly
  labelled reference profile, but require review before saving.

### P2: Broader frontend/backend compatibility remains incomplete

Observed during testing: some mobile calls such as insights/profile paths have
previously returned 404 against the M1-M8 backend. This handoff only verified
M5, authentication, and manual meal ingestion.

Required next work:

- Produce one API-contract test suite covering every screen.
- Make the app's API client paths match the backend OpenAPI specification.
- Remove or clearly isolate the legacy API implementation in the frontend
  repository to avoid accidental routing to the wrong backend.

## Suggested Acceptance Tests

Run these before presenting M5 as functional:

1. Model status reports `models` after a clean restart.
2. A supported catalog image without a hint returns a suggestion or an honest
   no-suggestion rejection.
3. Selecting a suggestion resubmits the exact original image.
4. An implausible portion returns `portion_implausible` with all macro fields
   null.
5. Manual logging persists a meal with exactly the user-entered macros.
6. A benchmark set of weighed meals meets documented mass and carbohydrate
   error targets; otherwise the UI remains labelled approximate/experimental.
7. Android emulator and physical-device uploads work with the configured API
   host, not just browser localhost.

## Important Product Boundary

The current system can demonstrate a working ML pipeline and assisted dish
selection. It cannot yet support a claim that arbitrary meal photos receive
accurate nutrition estimates. The safe product behavior is:

- show model-backed suggestions;
- require a dish confirmation;
- reject unreliable portions;
- always provide manual logging.
