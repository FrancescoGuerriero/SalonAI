from fastapi import APIRouter, Depends, Request

from app.core.security import require_service_key
from app.schemas.stylist_copilot import (
    StylistCopilotRequest,
    StylistCopilotResponse,
)
from app.services.stylist_copilot import build_stylist_copilot


router = APIRouter(
    prefix="/stylist-copilot",
    tags=["stylist-copilot"],
    dependencies=[Depends(require_service_key)],
)


@router.post(
    "/brief",
    response_model=StylistCopilotResponse,
)
async def generate_stylist_copilot_brief(
    payload: StylistCopilotRequest,
    request: Request,
) -> StylistCopilotResponse:
    return build_stylist_copilot(
        payload,
        provider_mode=request.app.state.settings.provider_mode,
    )
