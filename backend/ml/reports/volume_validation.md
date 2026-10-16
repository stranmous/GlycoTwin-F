# Volume Method Validation (Nutrition5k)

## Dataset
Nutrition5k (CC-BY 4.0, Thames et al. CVPR 2021), via public GCS mirror.
80 overhead RGB-D dishes (cafe1 split), each with `rgb.png`, `depth_raw.png`
(RealSense, 640x480), and weighed mass from `dish_metadata_cafe1.csv`.

## Protocol
- **Ground truth:** metric food height per pixel = table-plane depth minus raw
  depth (table = median of image border, 0.2-0.6m band); food mask = pixels
  >5mm above table. Y = sum of metric heights over food mask (m).
- **Pipeline term:** Depth Anything V2 (small, HF) relative depth, min-max
  normalised per image (exactly as served by `depth.py`), summed over the
  same food mask. Three shapes compared (constant factored out):
  - A (current): `area * mean(d_rel) * min(w,h)`
  - B (median):  `area * median(d_rel) * min(w,h)`
  - C (range):   `area * (p90(d_rel)-p10(d_rel)) * min(w,h)`
- **Fit:** least-squares k (m/px) per shape; MAPE and R^2 on the 80 dishes.

## Results (n=80)

| shape | k (m/px) | MAPE | R^2 |
|---|---|---|---|
| A current (mean) | 1.80e-4 | 17.0% | 0.746 |
| B median | 1.77e-4 | 18.1% | 0.722 |
| C range | 2.88e-4 | 30.2% | -0.018 |

Shape A (the shipped method) wins. The per-pixel height-integration variant is
algebraically identical to A (mean*area = sum), so A vs B vs C is the honest
comparison. Depth sign convention verified: Depth Anything relative depth is
higher on food than table (no inversion needed).

## From k to the geometric constant
The pipeline computes `V = C * s^3 * area * mean(d_rel) * min_dim` where s is
the reference-object scale (m/px) and C was the unvalidated 0.35 heuristic.
Ground truth is `V = s^2 * Y`. Equating: `C * s = Y / X = k`, so `C = k / s_rig`
with s_rig the rig's pixel size. At ~0.40m standoff:
- RealSense D435 (87 deg HFOV): s_rig = 1.19 mm/px -> C = 0.15
- RealSense D415 (65 deg HFOV): s_rig = 0.80 mm/px -> C = 0.23

The shipped constant is now **C = 0.19** (midpoint), replacing the 0.35
heuristic — a 1.5-2.3x correction. `VOLUME_METHOD` renamed to
`relative_depth_scaled_area_v2_nutrition5k`.

## Honest limitations
- The 0.19 is calibrated on **overhead** rig geometry. Phone photos are taken
  at an angle, closer, with different depth-normalisation behaviour; the
  constant needs re-calibration on weighed phone-captured portions (M5 future
  work: the weighed-portion study).
- The camera model (D435 vs D415) is not documented in the public metadata;
  the [0.15, 0.23] range reflects that uncertainty.
- MAPE 17% is on overhead cafeteria dishes; real-world accuracy will be worse
  until the phone-geometry calibration is done. All volume numbers remain
  labelled approximate.
