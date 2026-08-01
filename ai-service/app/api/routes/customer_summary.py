from fastapi import APIRouter, Depends, Request

from app.core.security import require_service_key
from app.schemas.customer_summary import (
    CustomerSummaryRequest,
    CustomerSummaryResponse,
)
from app.services.customer_summariser import build_customer_summary

router = APIRouter(
    prefix="/customer-summaries",
    tags=["customer-summaries"],
    dependencies=[Depends(require_service_key)],
)


@router.post(
    "/generate",
    response_model=CustomerSummaryResponse,
)
async def generate_customer_summary(
    payload: CustomerSummaryRequest,
    request: Request,
) -> CustomerSummaryResponse:
    return build_customer_summary(
        payload,
        provider_mode=request.app.state.settings.provider_mode,
    )
