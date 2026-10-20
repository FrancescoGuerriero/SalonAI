from fastapi import APIRouter, Depends, Request

from app.core.security import require_service_key
from app.schemas.consultation import (
    ConsultationAssistanceRequest,
    ConsultationAssistanceResponse,
)
from app.services.consultation_assistance import build_consultation_assistance


router = APIRouter(
    prefix="/consultations",
    tags=["consultations"],
    dependencies=[Depends(require_service_key)],
)


@router.post(
    "/assist",
    response_model=ConsultationAssistanceResponse,
)
async def assist_consultation(
    payload: ConsultationAssistanceRequest,
    request: Request,
) -> ConsultationAssistanceResponse:
    return build_consultation_assistance(
        payload,
        provider_mode=request.app.state.settings.provider_mode,
    )
