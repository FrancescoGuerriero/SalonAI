from fastapi import APIRouter,Depends,Request
from app.core.config import Settings,get_settings
from app.core.security import require_service_key
from app.schemas.management_copilot import ManagementCopilotRequest,ManagementCopilotResponse
from app.services.management_copilot import build_management_copilot_brief
router=APIRouter(prefix="/management-copilot",tags=["management-copilot"])
@router.post("/brief",response_model=ManagementCopilotResponse,dependencies=[Depends(require_service_key)])
def create_management_brief(payload:ManagementCopilotRequest,request:Request,settings:Settings=Depends(get_settings)):
    request.state.ai_capability="management-copilot"
    return build_management_copilot_brief(payload,provider_mode=settings.provider_mode)
