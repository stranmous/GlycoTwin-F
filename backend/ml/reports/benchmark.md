# M3 held-out benchmark (ohiot1dm) — test patients 591

| model | RMSE | MAE | Clarke A | Clarke A+B |
|---|---|---|---|---|
| persistence | 51.68 | 36.46 | 52.1% | 93.6% |
| ridge | 43.64 | 30.07 | 61.6% | 94.30000000000001% |
| mean_meal_response | 49.43 | 34.62 | 56.7% | 92.2% |
| gru | 48.61 | 39.13 | 44.6% | 90.30000000000001% |
| physics_only | 45.5 | 32.63 | 57.4% | 93.3% |
| hybrid | 44.3 | 31.78 | 58.1% | 93.2% |

Ship gate (hybrid beats physics-only): **True** (ΔRMSE 1.2 mg/dL)
