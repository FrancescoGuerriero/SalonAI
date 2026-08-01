from fastapi import APIRouter, Depends, Request

from app.core.config import Settings, get_settings
from app.core.security import require_service_key
from app.schemas.customer_segmentation import (
    CustomerSegmentationRequest,
    CustomerSegmentationResponse,
)
from app.services.customer_segmenter import analyse_customer_segments


router = APIRouter(
    prefix="/customer-segmentation",
    tags=["customer-segmentation"],
)


@router.post(
    "/analyse",
    response_model=CustomerSegmentationResponse,
    dependencies=[Depends(require_service_key)],
)
def analyse_segments(
    payload: CustomerSegmentationRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> CustomerSegmentationResponse:
    request.state.ai_capability = "customer-segmentation"

    return analyse_customer_segments(
        payload,
        provider_mode=settings.provider_mode,
    )
