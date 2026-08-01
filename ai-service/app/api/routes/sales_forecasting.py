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
from app.schemas.sales_forecasting import (
    SalesForecastRequest,
    SalesForecastResponse,
)
from app.services.sales_forecaster import (
    build_ai_sales_forecast,
)


router = APIRouter(
    prefix="/sales-forecasting",
    tags=["sales-forecasting"],
)


@router.post(
    "/forecast",
    response_model=SalesForecastResponse,
    dependencies=[
        Depends(require_service_key),
    ],
)
def forecast_sales(
    payload: SalesForecastRequest,
    request: Request,
    settings: Settings = Depends(
        get_settings
    ),
) -> SalesForecastResponse:
    """
    Generate an explainable sales forecast from
    privacy-safe aggregate salon financial data.

    The endpoint accepts historical daily totals for
    service sales, retail sales, memberships, gift
    cards, discounts, refunds, costs and transactions.

    Customer, staff and payment-card information must
    not be included in the request.
    """

    request.state.ai_capability = (
        "sales-forecasting"
    )

    return build_ai_sales_forecast(
        payload,
        provider_mode=
            settings.provider_mode,
    )