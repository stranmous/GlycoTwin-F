# GlycoTwin

Bilingual (English / اردو) cross-platform mobile app for people managing diabetes. Scan meals, simulate glucose responses, track Time-in-Range, and chat with an AI Coach — all educational, never medical advice.

## Stack

| Layer | Technology |
|---|---|
| Mobile | Expo Dev Client (SDK 51), TypeScript, Expo Router |
| UI | Tamagui (light + dark), Reanimated 3, Moti |
| Charts | victory-native, react-native-svg |
| Auth (client) | Firebase Auth (email + Google) |
| State | TanStack Query + Zustand |
| i18n | i18next + expo-localization (EN / UR + RTL) |
| API | FastAPI + async SQLAlchemy + PostgreSQL 16 |
| Migrations | Alembic |
| AI Coach | Gemini via `google-genai` (server-side only) |
| Local infra | Docker Compose (Postgres) |

---

## Prerequisites

- **Node 20+** and **pnpm 9+**
- **Python 3.12+** and **uv** — install with `pip install uv` or `winget install astral-sh.uv`
- **Docker Desktop** (for Postgres)
- **Expo Go** or a physical device / emulator for mobile
- **Firebase project** (free tier) — setup steps below
- **Gemini API key** — only needed for live AI Coach replies

---

## Quick start

### 1. Install JS dependencies

```bash
pnpm install
```

### 2. Set up environment files

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL=postgresql+asyncpg://glycotwin:glycotwin@localhost:5432/glycotwin
AUTH_DEV_BYPASS=true          # skip Firebase token check in dev
GEMINI_API_KEY=...            # leave blank to use stub Coach replies
GEMINI_MODEL=gemini-2.5-flash
```

Edit `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_AUTH_DEV_BYPASS=true
# Firebase values only needed when AUTH_DEV_BYPASS=false
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

### 3. Start Postgres

```bash
docker compose -f infra/docker-compose.yml up -d
```

Wait for `pg_isready` (healthcheck passes in ~5 s). To stop: `docker compose -f infra/docker-compose.yml down`.

### 4. Run migrations and start the API

```bash
cd apps/api
uv sync                                        # create venv and install deps
uv run alembic upgrade head                    # create all tables
uv run uvicorn app.main:app --reload           # http://localhost:8000
```

Verify: open `http://localhost:8000/healthz` → `{"status":"ok"}`.
API docs: `http://localhost:8000/docs`.

### 5. Start the mobile app

```bash
cd apps/mobile
pnpm start        # opens Expo dev server
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR with Expo Go.

> **First run with `AUTH_DEV_BYPASS=true`**: you can log in with any email/password — the token is used as a user identifier directly, no Firebase needed. Disable bypass and configure Firebase for a real auth flow.

---

## Firebase setup (for production auth)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → Create project.
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Project settings** → Service accounts → **Generate new private key** → save as `apps/api/firebase-service-account.json` (this file is gitignored).
4. Set `AUTH_DEV_BYPASS=false` and `FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json` in `apps/api/.env`.
5. **Project settings** → Your apps → add **Android** and **iOS** apps:
   - Download `google-services.json` → `apps/mobile/android/app/` (gitignored).
   - Download `GoogleService-Info.plist` → `apps/mobile/ios/GlycoTwin/` (gitignored).
6. Copy the **web config** values (apiKey, authDomain, projectId, appId) into `apps/mobile/.env` as `EXPO_PUBLIC_FIREBASE_*` vars.
7. Set `EXPO_PUBLIC_AUTH_DEV_BYPASS=false` in `apps/mobile/.env`.

---

## Project structure

```
GlycoTwin/
├── apps/
│   ├── mobile/               # Expo Dev Client app
│   │   ├── app/              # Expo Router file-based routes
│   │   │   ├── (auth)/       # welcome, login, signup
│   │   │   ├── (onboarding)/ # consent, profile, medications, language
│   │   │   ├── (tabs)/       # today, insights, simulation, coach
│   │   │   ├── scan/         # camera, result
│   │   │   ├── meal/[id].tsx
│   │   │   └── settings/
│   │   ├── src/
│   │   │   ├── components/   # Logo, ScreenHeader, SafetyBadge, motion/*
│   │   │   ├── features/     # (chart helpers live in tab screens for now)
│   │   │   ├── lib/          # apiClient, authStore, themeStore, i18n, firebase
│   │   │   ├── locales/      # en.json, ur.json
│   │   │   └── types/        # api.ts (TypeScript shapes mirroring FastAPI schemas)
│   │   └── tamagui.config.ts # design tokens (light + dark, clinical-calm palette)
│   └── api/                  # FastAPI backend
│       ├── app/
│       │   ├── core/         # config, db, firebase token dependency
│       │   ├── models/       # SQLAlchemy ORM (user, meal, prediction, ...)
│       │   ├── schemas/      # Pydantic request/response
│       │   ├── routers/      # me, meals, predictions, simulations, insights, coach
│       │   └── services/     # vision stub, glucose model, insights, coach RAG
│       └── alembic/          # migrations
└── infra/
    └── docker-compose.yml    # Postgres 16
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/v1/me` | Current user profile |
| PUT | `/v1/me/profile` | Update profile + medications |
| POST | `/v1/meals/image` | Upload meal image → detection |
| GET | `/v1/meals` | List meals |
| GET | `/v1/meals/{id}` | Single meal |
| PUT | `/v1/meals/{id}` | Edit detected foods |
| POST | `/v1/predictions/baseline` | Generate baseline glucose curve |
| POST | `/v1/simulations/what-if` | Run what-if simulation |
| GET | `/v1/insights/summary` | TIR + cards for today/7d/30d |
| POST | `/v1/coach/messages` | Send message to AI Coach |

All endpoints require `Authorization: Bearer <firebase-id-token>` (or dev UID when bypass is on).

---

## Design system

- **Palette**: clinical-calm teal (`#0F766E` primary), mint success, coral warn, rose danger.
- **Light + dark** with user toggle (Settings → Theme) and system default.
- **Motion**: spring physics (Reanimated 3 + Moti), shimmer skeletons, glow pulse on primary CTA, scale-on-press haptics.
- **Typography**: Inter (English), Noto Naskh Arabic (Urdu).
- **Numerics**: always Latin digits (`mg/dL`, carbs) to avoid clinical ambiguity in both languages.

---

## Urdu / RTL

Switch language in onboarding or **Settings → Language**. Switching between LTR and RTL triggers an app reload prompt (React Native limitation). All user-facing strings live in `src/locales/en.json` and `ur.json` — no hard-coded text anywhere.

---

## Safety

- The AI Coach refuses insulin dosage, diagnosis, and emergency guidance.
- Every simulation shows an **"Educational simulation only"** badge.
- The `safety_category` field in every coach reply drives the UI styling.
- Gemini API key is backend-only — never bundled in the mobile app.

---

## Acceptance checklist

- [ ] App runs on iOS + Android (Expo Dev Client).
- [ ] Meal log completable < 10 s after image select (with backend running locally).
- [ ] Simulation result updates < 3 s after slider change.
- [ ] TIR dashboard uses 70–180 mg/dL.
- [ ] Urdu mode is fully RTL + translated.
- [ ] No screen gives diagnosis, dosage, or medication advice.
- [ ] Coach responds to "how much insulin should I take?" with a refusal.
- [ ] Dark mode renders correctly across all screens.
