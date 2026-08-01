from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.security import require_service_key
from app.schemas.haircare import (
    HaircareRecommendationRequest,
    HaircareRecommendationResponse,
)
from app.services.haircare_recommender import build_haircare_recommendation

router = APIRouter(
    prefix="/haircare",
    tags=["haircare"],
    dependencies=[Depends(require_service_key)],
)


@router.post(
    "/recommendations",
    response_model=HaircareRecommendationResponse,
)
async def recommend_haircare(
    payload: HaircareRecommendationRequest,
    request: Request,
) -> HaircareRecommendationResponse:
    return build_haircare_recommendation(
        payload,
        provider_mode=request.app.state.settings.provider_mode,
    )
