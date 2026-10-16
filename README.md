# GlycoTwin

> **A Hybrid Neuro-Symbolic Digital Twin for Personalized Glycemic Response**  
> Mobile-First (Android / iOS / Web) Application & Clinical Decision-Support Platform  
> **COMSATS University Islamabad — Final Year Project (FYP) 2026**

---

## Team & Supervision

| Role | Name | Registration No. | Focus Area |
|---|---|---|---|
| **Undergraduate Student** | **Waqas Zafar** | SP23-BAI-052 | Frontend Architecture, Mobile Engineering & Computer Vision UX |
| **Undergraduate Student** | **Arsalan Qasim** | FA22-BAI-009 | Backend Architecture, Mathematical Physics ODE & AI Core |
| **Project Supervisor** | **Dr. Basit Raza** | — | Advisory & Clinical Research Supervision |

---

## Executive Summary

GlycoTwin is an end-to-end metabolic digital twin platform designed to empower individuals with Type 1, Type 2, and prediabetes to understand and manage their blood glucose dynamics.

By bridging **mechanistic physiological differential equations (ODEs)** with **deep learning residual correction**, **computer-vision volumetric meal scanning**, and an **evidence-grounded AI Coach**, GlycoTwin delivers personalized predictions, "what-if" meal simulation, and clinical Time-in-Range (TIR) analytics in both English and Urdu (RTL).

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               GlycoTwin Mobile / Web App (Expo SDK 51)                 │
│         "Warm Companion" Design System · Tamagui · Nunito Font         │
│          Bilingual English (LTR) & Native Urdu (RTL) Support           │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │  REST API (JWT Bearer Auth)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend Core (Port 8000)                     │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ M1 Ingestion      │ M2 Calibration    │ M3 Predictive Core             │
│ - OhioT1DM/D1NAMO │ - Phenotyping     │ - Hybrid ODE Physics Solver    │
│ - CGM History     │ - CalibratedState │ - 0–120 min Glucose Trajectory │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ M4 Native Auth    │ M5 Nutrition      │ M6 What-If Simulation          │
│ - Secure JWT      │ - FastSAM Segm.   │ - Counterfactual Comparison    │
│ - Onboarding Flow │ - Depth Anything  │ - Walking, Portions, Swaps     │
│ - User Profile    │ - CLIP Classifier │ - Delta Peak & iAUC Metrics    │
├───────────────────┴───────────────────┼────────────────────────────────┤
│ M7 Insights                           │ M8 RAG AI Coach                │
│ - Time-in-Range (70–180 mg/dL)        │ - Google Gemini (3 Flash)      │
│ - Top Spike Meals                     │ - ADA / IDF Guideline Vector DB│
│ - 1D / 7D / 30D Windows               │ - Clinical Medical Guardrails  │
└───────────────────────────────────────┴────────────────────────────────┘
```

---

## Key Highlights & Innovations

### 1. "Warm Companion" Visual Identity
- **Palette**: Organic warmth with `#FFFBF5` primary cream canvas, `#2AA89A` warm teal primary, `#FFE5D9` soft peach, and `#81C995` clinical sage.
- **Typography**: Google's `Nunito` across headings, numeric readouts, and body text.
- **Bilingual & RTL**: Seamless language toggle between English and native Nastaliq/Urdu with mirrored layouts, preserving Western Latin digits (`mg/dL`, `g`, `kcal`) for clinical precision.

### 2. Multi-Module Engine (M1–M8)
- **M1 Ingestion**: Ingests CGM streams, meal logs, and metabolic history with anomaly filtering.
- **M2 Calibration**: Resolves demographic default cold-starts into personalized patient parameters (insulin sensitivity, carb absorption rates).
- **M3 Predictive Core**: Generates 0–120 minute post-meal ODE glucose curves with model provenance badges (`v1.0.0-hybrid-ode`).
- **M4 Native Auth**: Fast, self-contained JWT authentication with secure profile updates and account controls.
- **M5 Volumetric Nutrition**: Combines FastSAM segmentation, Depth Anything v2 depth estimation, and CLIP zero-shot classification with coin reference scale detection, standard plate scaling warnings, and an always-available manual meal logger.
- **M6 What-If Simulation Hub**: Lets users combine counterfactual adjustments (`Walk +20 min`, `-25% portion`, `Swap to roti`, `Add protein`) and visualizes live dual comparison curves with delta peak and delta iAUC stats.
- **M7 Insights**: Clinical 70–180 mg/dL Time-in-Range gauges, breakdown bands (In Range, Above, Below), and top spike meals.
- **M8 AI Coach**: Evidence-grounded retrieval against American Diabetes Association (ADA) Standards of Care powered by Gemini 3 Flash. Built-in medical guardrails prevent diagnostic or insulin dosage recommendations, and clean response sanitization eliminates repetitive legal boilerplate from chat bubbles while preserving clinical verification badges (`✓ Clinically Verified · ADA Guidelines`).

---

## Repository Structure

```
GlycoTwin-F/
├── apps/
│   └── mobile/                 # React Native / Expo web & mobile application
│       ├── app/                # Expo Router file-based screens
│       │   ├── (auth)/         # Welcome, Login, Sign Up, Verify Email
│       │   ├── (onboarding)/   # Consent, Profile, Medications, Language
│       │   ├── (tabs)/         # Today Dashboard, Insights, Simulation Hub, AI Coach
│       │   ├── meal/[id].tsx   # Meal detail & ODE trajectory
│       │   ├── scan/           # Camera viewfinder & Nutrition scan result
│       │   └── settings/       # Profile, Theme, Language, Data Import, Server Selector
│       ├── src/
│       │   ├── components/     # Logo, ScreenHeader, SafetyBadge, Buttons, Cards
│       │   ├── lib/            # apiClient, authStore, twinStore, themeStore, mealImage
│       │   └── locales/        # English (en.json) & Urdu (ur.json) translation dictionaries
│       ├── package.json
│       └── tamagui.config.ts
├── backend/                    # FastAPI 8-Module Python Backend
│   ├── app/
│   │   ├── core/               # Configuration, security, crypto, logging
│   │   ├── modules/            # M1 Ingestion, M2 Calibration, M3 Predictions,
│   │   │                       # M4 Auth, M5 Nutrition, M6 Simulation, M7 Insights, M8 Coach
│   │   └── main.py             # FastAPI entrypoint, CORS, lifespan preflight checks
│   ├── tests/                  # Automated test suites (unit, safety, contracts)
│   ├── weights/                # Downloaded vision weights (gitignored)
│   ├── pyproject.toml
│   ├── uv.lock
│   └── .env.example
├── scripts/
│   ├── fetch_weights.py        # Automated downloader for FastSAM, Depth Anything, and CLIP
│   └── gen_key.py              # Cryptographic key generator for local encryption
├── package.json                # Monorepo root workspace config
├── pnpm-workspace.yaml
├── run_local.ps1               # 1-Click local startup script (Frontend + Backend)
└── README.md
```

---

## Prerequisites

Ensure the following tools are installed:

- **Node.js**: `v20.x` or later
- **pnpm**: `v9.x` (`npm install -g pnpm`)
- **Python**: `3.12+` or `3.14`
- **uv**: Astral's ultra-fast Python package installer (`pip install uv` or `winget install astral-sh.uv`)

---

## Quick Start (One-Click)

On Windows, run the provided automated PowerShell runner from the project root:

```powershell
.\run_local.ps1
```

This script:
1. Clears any orphaned processes on port `8000` or `8081`.
2. Starts the **FastAPI Backend** on `http://localhost:8000`.
3. Starts the **Expo Mobile/Web App** on `http://localhost:8081`.
4. Launches the app in a dedicated smartphone viewport (`410x880`).

---

## Manual Setup

### 1. Backend Setup

```bash
cd backend

# Create virtual environment and install dependencies
uv sync

# Copy environment variables
cp .env.example .env
```

*Note: In `backend/.env`, provide your Google Gemini API key (`GEMINI_API_KEY`) for live AI Coach responses. If omitted, the coach automatically falls back to offline evidence-grounded local corpus answers.*

#### Download Vision Weights (M5)

Run the automated weight fetcher to download FastSAM, Depth Anything v2, and CLIP:

```bash
python ../scripts/fetch_weights.py
```

#### Run the Backend

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
```

Verify backend health:
- Health check: `http://localhost:8000/healthz`
- Interactive Swagger docs: `http://localhost:8000/docs`
- M5 Vision status: `http://localhost:8000/api/v1/nutrition/status` (`"vision_mode": "models"`)

---

### 2. Frontend Setup

From the repository root:

```bash
# Install frontend dependencies
pnpm install

# Copy mobile environment variables
cp apps/mobile/.env.example apps/mobile/.env

# Start the Expo web & mobile application
pnpm --filter @glycotwin/mobile start --web --port 8081
```

Open `http://localhost:8081` in your browser.

---

## Demonstration Credentials

Pre-seeded demonstration account with complete onboarding and metabolic calibration:

- **Email**: `waqas.fyp@glycotwin.pk`
- **Password**: `Password123!`

*(You can also register a new account at `/signup`; calibration and digital twin state are initialized automatically.)*

---

## Dual-Backend Connectivity (Localhost & Azure Cloud VM)

GlycoTwin supports dual-mode backend routing:
1. **Localhost**: `http://localhost:8000` (default for local development and offline testing).
2. **Hosted Azure VM**: `https://glycotwin-demo.indiasouthcentral.cloudapp.azure.com` (for remote device testing without local servers).

You can switch the target backend at any time directly in the app via **Settings → Server Selector**.

---

## Automated Verification & Tests

### Backend Test Suite (29 Tests)
Runs safety guardrail verification, Gemini LLM fallback, adversarial dosage detection, and API OpenAPI contracts:

```bash
cd backend
uv run --with pytest python -m pytest tests/test_m8_guardrail.py tests/test_m8_llm_provider.py tests/test_api_contracts.py -v
```

### Frontend Type Safety
Performs strict TypeScript validation across all routes, components, and state stores:

```bash
pnpm --filter @glycotwin/mobile typecheck
```

---

## Clinical Safety Notice

> **Educational Decision-Support Only**: GlycoTwin is designed for research and educational purposes. It does not provide medical diagnoses, treatment prescriptions, or insulin dosage calculations. Users must always consult their physician before making changes to their diabetes management plan.

---

## License

This project is submitted in partial fulfillment of the requirements for the Degree of Bachelor of Science in Artificial Intelligence at COMSATS University Islamabad. All rights reserved.
