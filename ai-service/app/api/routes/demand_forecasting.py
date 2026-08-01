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
from app.schemas.demand_forecasting import (
    AppointmentDemandForecastRequest,
    AppointmentDemandForecastResponse,
)
from app.services.demand_forecaster import (
    build_appointment_demand_forecast,
)


router = APIRouter(
    prefix="/demand-forecasting",
    tags=["demand-forecasting"],
)


@router.post(
    "/forecast",
    response_model=
        AppointmentDemandForecastResponse,
    dependencies=[
        Depends(
            require_service_key
        ),
    ],
    summary=(
        "Forecast salon appointment demand"
    ),
    description=(
        "Generates an explainable daily "
        "appointment-demand forecast from "
        "anonymous historical operational data."
    ),
)
def forecast_appointment_demand(
    payload:
        AppointmentDemandForecastRequest,

    request: Request,

    settings: Settings = Depends(
        get_settings
    ),
) -> AppointmentDemandForecastResponse:
    """
    Generate an appointment-demand forecast.

    Authentication is performed with the
    Express-to-FastAPI shared service key.

    The payload contains operational statistics
    only. Customer names, contact details,
    addresses and free-text notes must never be
    included.
    """

    request.state.ai_capability = (
        "appointment-demand-forecasting"
    )

    return build_appointment_demand_forecast(
        payload,
        provider_mode=
            settings.provider_mode,
    )