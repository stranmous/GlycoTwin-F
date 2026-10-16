from fastapi import APIRouter, Depends

from app.core.cache import simulation_cache
from app.core.security import get_current_user
from app.modules.m6_simulation.schemas import (
    SimulationComparisonRequest,
    SimulationComparisonResult,
)
from app.modules.m6_simulation.service import run_counterfactual_simulation

router = APIRouter()


@router.post("/compare", response_model=SimulationComparisonResult)
def compare_scenarios(request: SimulationComparisonRequest,
                      user_id: str = Depends(get_current_user)):
    # The cache key excludes server-side timestamps (see
    # SimulationComparisonRequest.cache_key_dict) so identical requests hit.
    cache_payload = request.cache_key_dict()
    cached_result = simulation_cache.get_simulation_result("simulation_compare", cache_payload)
    if cached_result:
        return SimulationComparisonResult(**cached_result)

    result = run_counterfactual_simulation(request)
    simulation_cache.set_simulation_result("simulation_compare", cache_payload, result)
    return result


@router.get("/status")
def status() -> dict[str, str]:
    return {
        "module": "6",
        "name": "counterfactual-simulation",
        "status": "active",
    }
