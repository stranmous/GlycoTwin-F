# M3 leave-one-patient-out benchmark (OhioT1DM) — fair protocol

Protocol: `y0=start_glucose`; calibration on earlier-data-only windows;
per-patient `(k_abs, S_i)` fitted on train patients only; held-out patient uses
population-median params; baselines fitted on train windows only.
6 patients (559, 563, 570, 575, 588, 591), 972 windows, 24,300 points.

| model | RMSE | MAE | Clarke A+B |
|---|---|---|---|
| ridge | **44.04** | 30.56 | 93.4% |
| hybrid (physics + neural residual) | 48.14 | 33.90 | 91.7% |
| physics-only | 48.48 | 34.01 | 92.0% |
| mean_meal_response | 47.04 | — | — |
| persistence | 50.41 | 34.69 | 93.3% |
| gru | 54.32 | — | — |

Bootstrap 95% CI (RMSE): hybrid [43.14, 55.66] vs physics-only [43.20, 56.14] —
fully overlapping, no meaningful difference. Gate stays closed: production
serves physics-only (`ZeroResidual`).

Per-patient RMSE (ridge / physics / hybrid): 559: 51.10/52.68/51.96 ·
563: 40.08/40.96/41.04 · 570: 45.50/65.23/65.23 · 575: 43.44/45.42/45.26 ·
588: 41.64/42.98/42.91 · 591: 43.64/45.50/44.30.

Source of truth: `crossval_ohio.json` (same directory).
