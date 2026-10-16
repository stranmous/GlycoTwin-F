import math

from app.modules.m2_calibration.schemas import CalibratedState


def generate_augmented_trajectory(
    state: CalibratedState, 
    meal_carbs_g: float, 
    duration_minutes: int = 120, 
    step_minutes: int = 5
) -> list[dict[str, float]]:
    """
    Generates a physics-informed synthetic glucose trajectory.
    Uses a simplified mechanistic metabolic model based on insulin sensitivity 
    and gut carb absorption rate.
    """
    trajectory = []
    current_glucose = state.baseline_glucose_mg_dl
    
    for t in range(0, duration_minutes + step_minutes, step_minutes):
        trajectory.append({
            "time_offset_minutes": float(t),
            "glucose_mg_dl": round(current_glucose, 2)
        })
        
        # Simplified dG/dt model:
        # 1. Glucose decays towards baseline based on insulin sensitivity.
        # 2. Carbs increase glucose, modeled as a delayed absorption curve.
        
        # Insulin action decay — S_i is in M3 ODE units, so scale by basal
        # insulin (10) to get the effective per-minute relaxation rate.
        decay = state.estimated_insulin_sensitivity * 10.0 * (current_glucose - state.baseline_glucose_mg_dl)
        
        # Carbohydrate absorption (t/10 * exp(-t/20) represents gut absorption delay)
        absorption = state.carb_absorption_rate_index * meal_carbs_g * (t / 10.0) * math.exp(-t / 20.0)
        
        dG_dt = absorption - decay
        current_glucose += dG_dt * step_minutes
        
        # Clamp to physiological bounds
        current_glucose = max(20.0, min(600.0, current_glucose))
        
    return trajectory
