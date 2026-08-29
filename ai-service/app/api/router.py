from fastapi import APIRouter

from app.api.routes.customer_segmentation import (
    router as customer_segmentation_router,
)
from app.api.routes.customer_summary import (
    router as customer_summary_router,
)
from app.api.routes.demand_forecasting import (
    router as demand_forecasting_router,
)
from app.api.routes.haircare import (
    router as haircare_router,
)
from app.api.routes.health import (
    router as health_router,
)
from app.api.routes.management_copilot import (
    router as management_copilot_router,
)
from app.api.routes.marketing_insights import (
    router as marketing_insights_router,
)
from app.api.routes.no_show_prediction import (
    router as no_show_prediction_router,
)
from app.api.routes.sales_forecasting import (
    router as sales_forecasting_router,
)
from app.api.routes.whatsapp_bot import (
    router as whatsapp_bot_router,
)


api_router = APIRouter()


# Public health and readiness endpoints.
api_router.include_router(
    health_router
)


# Authenticated AI capability endpoints.
api_router.include_router(
    haircare_router,
    prefix="/api/v1",
)

api_router.include_router(
    customer_summary_router,
    prefix="/api/v1",
)

api_router.include_router(
    customer_segmentation_router,
    prefix="/api/v1",
)

api_router.include_router(
    demand_forecasting_router,
    prefix="/api/v1",
)

api_router.include_router(
    sales_forecasting_router,
    prefix="/api/v1",
)

api_router.include_router(
    marketing_insights_router,
    prefix="/api/v1",
)

api_router.include_router(
    no_show_prediction_router,
    prefix="/api/v1",
)

api_router.include_router(
    management_copilot_router,
    prefix="/api/v1",
)

api_router.include_router(
    whatsapp_bot_router,
    prefix="/api/v1",
)