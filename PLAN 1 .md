# GlycoTwin Client Mobile App Plan

## Summary

Build GlycoTwin as a cross-platform React Native mobile app using Expo Dev Client, TypeScript, Expo Router, Firebase Authentication, and FastAPI/PostgreSQL for all metabolic profile, meal log, simulation, insight, and coach data.

The app will prioritize the frontend experience: fast meal capture, clear glucose prediction charts, bilingual English/Urdu support with RTL layouts, safety-first health messaging, and accessible visual explanations for non-technical users.

Chosen defaults:

- Mobile foundation: Expo Dev Client
- Auth: Firebase Authentication
- App/backend data path: FastAPI + PostgreSQL
- AI Coach: backend RAG service using Gemini, never called directly from the mobile app
- Urdu support: full translated RTL interface

## Product Structure

Use an auth-first flow, then a tab-based app shell.

Core navigation:

- Auth / onboarding stack
  - Welcome
  - Login / signup
  - Safety consent
  - Metabolic profile setup
  - Medication and treatment logging
  - Language selection
- Main app tabs
  - Today
  - Scan Meal
  - Simulation
  - Insights
  - AI Coach
- Secondary screens
  - Meal detail
  - Prediction detail
  - Historical logs
  - Profile settings
  - Data import
  - Privacy and safety settings

Primary user flow:

1. User signs in with Firebase.
2. User completes safety consent and profile setup.
3. User scans or imports a meal.
4. App displays detected food, estimated volume, carbs, and editable portions.
5. User opens Simulation Hub to compare baseline vs modified choices.
6. User reviews TIR and trend insights.
7. User asks the AI Coach for explanation or guidance.

## Key Frontend Modules

Module 4: User Profile & Auth

- Use Firebase email/password and optional Google sign-in.
- Store Firebase ID token securely using `expo-secure-store`.
- Send Firebase ID token as `Authorization: Bearer <token>` to FastAPI.
- Backend verifies Firebase token and owns user records.
- Profile fields:
  - age
  - sex
  - heightCm
  - weightKg
  - diabetesType
  - timezone
  - medications
  - usualMealTimes
  - preferredLanguage
  - consentAcceptedAt
- Include “informational only” consent before prediction features unlock.
- Medication UI must collect treatments as context only, not recommend dosage.

Module 5: Meal Camera Logger

- Use `expo-camera` for capture and `expo-image-picker` for gallery fallback.
- Camera screen must show the prompt: include a spoon or coin for scale.
- Upload image to backend vision endpoint as multipart form data.
- Display analysis states:
  - ready
  - capturing
  - uploading
  - analyzing
  - editable result
  - failed
- Result screen shows:
  - detected dish name in English and Urdu
  - segmentation/bounding overlay when available
  - estimated volume
  - estimated carbs
  - confidence
  - editable portion size
  - confirm log button
- User must be able to correct dish name, portion, and carbs before saving.

Module 6: Simulation Hub

- Main chart overlays:
  - Baseline glucose curve
  - Simulated glucose curve
  - target range band: 70-180 mg/dL
  - predicted peak
  - delta peak
  - time above range
- Use `victory-native` with `react-native-svg` for line and bar charts.
- Controls:
  - portion scale slider, 25%-150%
  - walk duration slider, 0-60 minutes
  - activity intensity segmented control: light, moderate
  - meal timing adjustment, now / +30 min / +60 min
- Slider changes call the backend simulation endpoint with debounce.
- Keep the previous curve visible while a new simulation is loading.
- Show “educational simulation only” near every simulated result.
- Target simulation response time: under 3 seconds.

Module 7: Insights Dashboard

- Primary metric: Time-in-Range, 70-180 mg/dL.
- Views:
  - today
  - 7 days
  - 30 days
- Dashboard widgets:
  - TIR gauge
  - daily glucose trend
  - average peak by meal type
  - top 3 spike-causing meals
  - recurring pattern cards
  - improvement cards over time
- Insight cards should use plain language:
  - “Lunch caused your highest average peak this week.”
  - “A 15 min walk after rice meals reduced projected peak by 18 mg/dL.”
- All insights must be traceable to actual logs or backend-derived summaries.

Module 8: AI Coach

- Chat UI supports English and Urdu.
- Mobile app sends user question and context ID to backend.
- Backend performs RAG and Gemini call.
- App receives:
  - coach message
  - related meal/log references
  - safety category
  - optional mini-chart data
  - suggested follow-up prompts
- The coach must refuse or redirect:
  - insulin dosage advice
  - medication adjustment
  - diagnosis
  - emergency medical guidance
- Visual explainability:
  - mini bar chart for spike contributors
  - small line chart for meal response
  - compact comparison card for baseline vs simulated outcome

## API Contract

Mobile app uses versioned FastAPI endpoints.

Required endpoints:

- `GET /v1/me`
- `PUT /v1/me/profile`
- `POST /v1/meals/image`
- `PUT /v1/meals/{mealId}`
- `GET /v1/meals`
- `GET /v1/meals/{mealId}`
- `POST /v1/predictions/baseline`
- `POST /v1/simulations/what-if`
- `GET /v1/insights/summary`
- `POST /v1/coach/messages`

Core TypeScript models:

- `UserProfile`
- `MedicationEntry`
- `MealLog`
- `DetectedFood`
- `NutritionEstimate`
- `GlucosePoint`
- `PredictionCurve`
- `SimulationRequest`
- `SimulationResult`
- `InsightCard`
- `CoachMessage`

All API calls use `fetch`, React Query, typed response mappers, retry handling, and user-friendly error states.

## Localization And RTL

Use `i18next`, `expo-localization`, and React Native `I18nManager`.

Rules:

- No hard-coded user-facing text.
- English and Urdu translations must exist for every screen.
- Urdu mode uses RTL layout, right-aligned text, mirrored directional icons, and Urdu-aware spacing.
- Keep glucose values and units as Latin numerals with `mg/dL` to avoid clinical ambiguity.
- Bundle `NotoNaskhArabic` for Urdu UI legibility.
- Language switch lives in onboarding and settings.
- Changing between LTR and RTL may trigger an app reload.

## State, Storage, And Security

- Firebase handles identity only.
- FastAPI/PostgreSQL stores profiles, meal logs, predictions, insights, and coach history.
- React Query handles server cache and loading states.
- SecureStore stores Firebase token/session metadata.
- Local temporary image URIs are removed after upload where possible.
- Gemini API key is never included in the app bundle.
- Use HTTPS only for production API calls.
- Offline mode allows viewing cached logs and insights, but scanning, simulation, and coach calls require network.

## Testing Plan

Unit tests:

- TIR calculation
- glucose range classification
- API response mapping
- profile form validation
- i18n key coverage
- medication input validation

Component tests:

- auth forms
- safety consent gate
- meal result edit screen
- simulation sliders and chart states
- insights dashboard widgets
- AI Coach refusal and mini-chart rendering
- English/Urdu language switch

End-to-end tests:

- signup/login
- onboarding and consent
- scan meal with mocked backend response
- edit and save meal
- run what-if simulation
- view TIR dashboard
- ask AI Coach in English and Urdu
- logout

Acceptance criteria:

- App runs on Android and iOS.
- Meal logging flow is completable in under 10 seconds after image selection when backend responds normally.
- Simulation result updates in under 3 seconds.
- TIR dashboard correctly uses 70-180 mg/dL.
- Urdu mode is fully RTL and translated.
- No screen gives diagnosis, insulin dosage, or medication adjustment advice.

## Implementation Sequence

1. Scaffold Expo Dev Client app with TypeScript, Expo Router, Firebase, React Query, i18n, and design tokens.
2. Build auth, onboarding, safety consent, profile, language settings, and secure token flow.
3. Build meal camera logger with mocked backend responses, editable nutrition result, and meal history.
4. Integrate real FastAPI endpoints for profile, meals, image upload, and prediction.
5. Build Simulation Hub charts, sliders, debounced what-if API calls, and result comparison UI.
6. Build Insights Dashboard with TIR gauge, meal peak charts, worst meals, and evolving insight cards.
7. Build AI Coach chat with backend RAG integration, bilingual prompts, safety states, and mini-charts.
8. Harden the app with RTL QA, accessibility labels, loading/error/empty states, offline cache behavior, and E2E tests.

## Assumptions

- Backend will expose FastAPI endpoints and verify Firebase ID tokens.
- PostgreSQL remains the source of truth for metabolic logs and predictions.
- CGM Bluetooth integration is out of scope.
- CSV/cloud glucose imports may be added through backend-supported import flows.
- The mobile app presents decision support only, not medical advice.
- Gemini usage is backend-owned and configurable without requiring a mobile app release.
