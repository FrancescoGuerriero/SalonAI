from fastapi import APIRouter, Depends, Request
from app.core.config import Settings, get_settings
from app.core.security import require_service_key
from app.schemas.no_show_prediction import NoShowPredictionRequest, NoShowPredictionResponse
from app.services.no_show_predictor import build_no_show_predictions
router = APIRouter(prefix="/no-show-prediction", tags=["no-show-prediction"])
@router.post("/predict", response_model=NoShowPredictionResponse, dependencies=[Depends(require_service_key)])
def predict_no_show_risk(payload: NoShowPredictionRequest, request: Request, settings: Settings = Depends(get_settings)):
    request.state.ai_capability = "no-show-prediction"
    return build_no_show_predictions(payload, provider_mode=settings.provider_mode)
