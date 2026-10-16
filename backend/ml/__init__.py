"""Offline ML workbench: training + evaluation for the M3 residual (WS1).

The trained artifact (weights + model card) is what crosses into
`app/modules/m3_predictive_core/`. One deliberate exception:
`app/modules/m2_calibration/parameter_fit.py` (serving) reuses
`ml.windows.extract_windows` and `ml.metrics.rmse` so the serving
least-squares fit and the offline benchmark operate on identical window
definitions and the same error metric.
"""
