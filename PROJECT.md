# Project: Backend Stability, Model Setup & Mobile Route Contract Alignment

## Architecture
- **Backend**: FastAPI monolithic service with 8 modular packages (`app/modules/m1_ingestion` to `m8_coach`), SQLAlchemy async SQLite database, PyTorch/HuggingFace ML pipelines (FastSAM, Depth Anything v2, CLIP-ViT).
- **Mobile Frontend**: Expo React Native TypeScript client (`apps/mobile`), Expo Router navigation, TanStack React Query, Axios/fetch `apiClient.ts`.
- **Integration Points**: `/api/v1/*` REST endpoints authenticated with native Bearer JWT tokens.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Model Path Configuration | Default `fastsam_model_path` to `weights/FastSAM-s.pt` and add `clip_model_path` to `Settings` in `config.py` | M1 | Survey (Explorer 1) |
| 2 | Weight Fetch Script Fixes | Update `scripts/fetch_weights.py` CLIP inventory (`preprocessor_config.json`, `pytorch_model.bin`, tokenizers) to eliminate 404 download errors | M1 | Survey (Explorer 1) |
| 3 | Lifespan Startup Preflight Check | Validate FastSAM, Depth Anything, and CLIP files on FastAPI boot; emit diagnostic warnings and remediation command on missing weights | M1 | Survey (Explorer 1) |
| 4 | Nutrition Status Verification | `GET /api/v1/nutrition/status` reports `"vision_mode": "models"` when weights exist, returns model health breakdown and degraded status | M1 | Survey (Explorer 1) |
| 5 | Test Suite Isolation | Isolate `tests/test_m5_pipeline.py` via `conftest.py` so offline CI fixture assertions pass while runtime runs real models | M1 | Survey (Explorer 1, 3) |
| 6 | Uvicorn Reload Restriction | Enforce `--reload-dir app` to prevent server reload thrashing from SQLite/photo writes | M1 | Survey (Explorer 1, 3) |
| 7 | Insights Summary Endpoint | Implement `GET /api/v1/insights/summary` in `app/modules/m7_insights/router.py` to resolve 404s on Today and Insights screens | M2 | Survey (Explorer 2) |
| 8 | Auth Profile Schema Resiliency | Make `activity_level` and optional fields resilient with defaults in `ProfileIn`; support partial updates and flexible medication formats | M2 | Survey (Explorer 2) |
| 9 | Ingestion & Simulation Schema Compatibility | Add `timestamp` alias in CGM readings history; add `sample_count` in TIR response; add `delta_tar_min` in simulation delta metrics | M2 | Survey (Explorer 2) |
| 10 | Mobile Client Path Normalization | Fix `normalizePath` in `apiClient.ts` to map `/v1/me` to `/api/v1/auth/me` instead of `/api/v1/auth/profile` | M3 | Survey (Explorer 2) |
| 11 | Mobile Insights & Profile Integration | Update `insights.tsx` to extract `{ readings: ... }`; supply `activity_level` in `profile.tsx`; remove dead fallback in `meal/[id].tsx` | M3 | Survey (Explorer 2) |
| 12 | Mobile TypeScript Cleanliness | Ensure `pnpm --filter @glycotwin/mobile typecheck` passes with zero errors | M3 | Survey (Explorer 2, 3) |
| 13 | Network Host Binding & CORS Origins | Configure host `0.0.0.0` and allow regex origins (`localhost:8081`, `127.0.0.1:8081`, `10.0.2.2`, LAN IPs) and proper headers | M4 | Survey (Explorer 3) |
| 14 | Automated API Contract Test Suite | Build automated contract test suite in `tests/test_api_contracts.py` verifying 200 OK across all active mobile endpoints | M4 | Survey (Explorer 2, 3) |
| 15 | End-to-End Acceptance Verification | Verify all acceptance criteria: clean boot, models vision mode, weights fetch, green test suite, zero 404s | M4 | Survey (Explorers 1, 2, 3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Model Config, Weight Fetch & Lifespan Preflight | Features 1–6: `config.py`, `fetch_weights.py`, `service.py`, `main.py` lifespan, `router.py` status, `conftest.py` | None | DONE |
| M2 | Backend API Route Alignment & Schema Resiliency | Features 7–9: `m7_insights/router.py`, `m4_auth/schemas.py`, `m4_auth/service.py`, `m1_ingestion/router.py`, `m6_simulation/schemas.py` | M1 | DONE |
| M3 | Mobile Route Contract Alignment & Client Fixes | Features 10–12: `apiClient.ts`, `insights.tsx`, `profile.tsx`, `meal/[id].tsx`, mobile typecheck | M2 | DONE |
| M4 | Network Host/CORS, Contract Test Suite & E2E Validation | Features 13–15: CORS in `main.py`, `tests/test_api_contracts.py`, run acceptance verifications | M3 | DONE |

## Interface Contracts
### Mobile Client ↔ Backend API
- `GET /api/v1/insights/summary?window={today|7d|30d}`:
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ window: str, tir: { in_range_pct: float, above_range_pct: float, below_range_pct: float, sample_count: int, mean_mg_dl: float, gmi_pct: float }, avg_peak_by_meal_type: dict, top_spike_meals: list, cards: list }`
- `GET /api/v1/auth/profile`:
  - Headers: `Authorization: Bearer <token>`
  - Response: `ProfileOut` containing `user_id, age, weight_kg, height_cm, diabetes_type, activity_level, medications, hba1c, bmi, display_name, email`
- `PUT /api/v1/auth/profile`:
  - Headers: `Authorization: Bearer <token>`
  - Body: Partial or full `ProfileIn` (`age?, weight_kg?, height_cm?, diabetes_type?, activity_level?, medications?, hba1c?, display_name?, preferred_language?`)
- `GET /api/v1/nutrition/status`:
  - Response: `{ module: "5", name: "volumetric-nutrition-quantifier", status: "active", vision_mode: "models", models: dict, degraded_models: list }`
- `GET /api/v1/ingestion/history/readings`:
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ status: "success", count: int, readings: list[{"glucose_mg_dl": float, "recorded_at": str, "timestamp": str, "source": str}] }`

## Code Layout
- Backend files:
  - `backend/app/core/config.py`: Application settings
  - `backend/app/main.py`: FastAPI application, lifespan, CORS
  - `backend/app/modules/m1_ingestion/router.py`: Ingestion endpoints
  - `backend/app/modules/m4_auth/schemas.py`: Auth and profile schemas
  - `backend/app/modules/m4_auth/service.py`: Profile business logic
  - `backend/app/modules/m5_nutrition/service.py`: Model loading & status
  - `backend/app/modules/m5_nutrition/router.py`: Nutrition status & estimate
  - `backend/app/modules/m6_simulation/schemas.py`: Simulation models
  - `backend/app/modules/m7_insights/router.py`: Insights endpoints & summary
  - `backend/app/modules/m7_insights/schemas.py`: Insights response schemas
  - `backend/tests/conftest.py`: Test fixtures and test environment setup
  - `backend/tests/test_m5_pipeline.py`: Nutrition pipeline unit tests
  - `backend/tests/test_api_contracts.py`: Comprehensive API contract tests
  - `scripts/fetch_weights.py`: Model weights downloader
- Mobile files:
  - `apps/mobile/src/lib/apiClient.ts`: URL normalization and fetch wrapper
  - `apps/mobile/app/(tabs)/insights.tsx`: Insights screen
  - `apps/mobile/app/(onboarding)/profile.tsx`: Onboarding profile submission
  - `apps/mobile/app/meal/[id].tsx`: Meal details screen
