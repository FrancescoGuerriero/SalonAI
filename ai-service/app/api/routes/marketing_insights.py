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

from app.schemas.marketing_insights import (
    MarketingInsightsRequest,
    MarketingInsightsResponse,
)

from app.services.marketing_insights_analyser import (
    build_ai_marketing_insights,
)


router = APIRouter(
    prefix="/marketing-insights",
    tags=[
        "marketing-insights",
    ],
)


@router.post(
    "/analyse",
    response_model=MarketingInsightsResponse,
    dependencies=[
        Depends(
            require_service_key
        ),
    ],
)
def analyse_marketing(
    payload: MarketingInsightsRequest,
    request: Request,
    settings: Settings = Depends(
        get_settings
    ),
) -> MarketingInsightsResponse:
    request.state.ai_capability = (
        "marketing-insights"
    )

    return build_ai_marketing_insights(
        payload,
        provider_mode=(
            settings.provider_mode
        ),
    )