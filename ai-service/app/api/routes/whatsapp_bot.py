from fastapi import (
    APIRouter,
    Depends,
    Request,
)

from app.core.config import (
    Settings,
    get_settings,
)
from app.core.security import (
    require_service_key,
)
from app.schemas.whatsapp_bot import (
    WhatsAppBotAnalysisRequest,
    WhatsAppBotAnalysisResponse,
)
from app.services.whatsapp_bot import (
    analyse_whatsapp_message,
)


router = APIRouter(
    prefix="/whatsapp-bot",
    tags=["whatsapp-bot"],
)


@router.post(
    "/analyse",
    response_model=
        WhatsAppBotAnalysisResponse,
    dependencies=[
        Depends(
            require_service_key
        )
    ],
)
def analyse_message(
    payload:
        WhatsAppBotAnalysisRequest,

    request:
        Request,

    settings:
        Settings =
        Depends(
            get_settings
        ),
) -> WhatsAppBotAnalysisResponse:
    request.state.ai_capability = (
        "whatsapp-bot"
    )

    return analyse_whatsapp_message(
        payload,
        provider_mode=
            settings.provider_mode,
    )