"""M2 calibration service.

calibrate_user(user_data, before=None, fit_physics=False): when `before` is
set, only readings and meals strictly earlier than that timestamp are used.
The benchmark uses this per meal (before=meal time) so the held-out window
can never leak into its own calibration — the earlier-data rule.

fit_physics runs the least-squares (k_abs, S_i) grid fit on the user's own
meal windows (the serving path). It defaults to False: the offline
benchmark (ml/) does its own per-patient fitting and must neither pay for
nor be changed by a redundant serving fit.
"""
from datetime import datetime

from app.modules.m1_ingestion.schemas import IngestedUserData
from app.modules.m2_calibration.augmentation import generate_augmented_trajectory
from app.modules.m2_calibration.parameter_fit import fit_physics_parameters
from app.modules.m2_calibration.phenotype import assign_phenotype
from app.modules.m2_calibration.schemas import CalibratedState


def _cutoff(user_data: IngestedUserData, before: datetime) -> IngestedUserData:
    """Copy of user_data restricted to events strictly before `before`."""
    return user_data.model_copy(update={
        "cgm_readings": [r for r in user_data.cgm_readings if r.timestamp < before],
        "meal_records": [m for m in user_data.meal_records if m.timestamp < before],
        "insulin_doses": [d for d in user_data.insulin_doses if d.timestamp < before],
    })


def calibrate_user(user_data: IngestedUserData,
                   before: datetime | None = None,
                   fit_physics: bool = False) -> CalibratedState:
    """Assigns phenotype and baseline parameters to the user.

    before: optional cutoff — use only data strictly before this timestamp
    (evaluation protocol; prevents look-ahead into the window being scored).
    fit_physics: fit (k_abs, S_i) by least squares on the user's own meal
    windows (serving path). With fewer than 3 usable windows the demographic
    defaults are kept and the state says so (estimation_method).
    """
    if before is not None:
        user_data = _cutoff(user_data, before)
    state = assign_phenotype(user_data)
    if fit_physics:
        state = fit_physics_parameters(state, user_data)
    return state


def augment_trajectory(state: CalibratedState, meal_carbs_g: float) -> list[dict[str, float]]:
    """Generates synthetic glucose trajectory for the given state and meal carbs."""
    return generate_augmented_trajectory(state, meal_carbs_g)
