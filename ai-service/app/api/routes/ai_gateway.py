from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.security import require_service_key
from app.governance.advisory_evaluation import (
    AdvisoryEvaluationRequest,
    AdvisoryEvaluationResponse,
    evaluate_advisory,
    evaluation_policy_snapshot,
)
from app.governance.ai_registry import (
    REGISTRY_VERSION,
    registered_tool,
    registry_snapshot,
)
from app.schemas.ai_gateway import (
    GatewayAdvisoryResponse,
    GatewayPlanRequest,
    GatewayPlanResponse,
)
from app.schemas.management_bi import (
    ManagementBiAnalysisRequest,
    ManagementBiAnalysisResponse,
)
from app.services.canonical_adviser import build_canonical_advisory
from app.services.management_bi import analyse_management_bi


router = APIRouter(
    prefix="/ai-gateway",
    tags=["ai-governance"],
)


def _registered_tool_or_error(payload: GatewayPlanRequest) -> dict:
    tool = registered_tool(payload.tool_key)
    if tool is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "AI_TOOL_NOT_REGISTERED",
                "message": "Requested AI capability is not registered.",
            },
        )
    evidence_contract = str(tool.get("evidenceContract", ""))
    if evidence_contract != payload.evidence.contract:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "AI_EVIDENCE_CONTRACT_MISMATCH",
                "message": "The requested capability does not accept this evidence contract.",
            },
        )
    return tool


def _management_tool_or_error(payload: ManagementBiAnalysisRequest) -> dict:
    tool = registered_tool(payload.tool_key)
    if tool is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "AI_TOOL_NOT_REGISTERED", "message": "Requested AI capability is not registered."},
        )
    if str(tool.get("key")) != "management-copilot":
        raise HTTPException(
            status_code=409,
            detail={"code": "AI_MANAGEMENT_TOOL_REQUIRED", "message": "Management BI analysis requires the governed management-copilot tool."},
        )
    if str(tool.get("evidenceContract", "")) != payload.evidence.contract:
        raise HTTPException(
            status_code=409,
            detail={"code": "AI_EVIDENCE_CONTRACT_MISMATCH", "message": "Management BI evidence does not match the registered contract."},
        )
    return tool


@router.get("/registry", dependencies=[Depends(require_service_key)])
def get_registry(request: Request) -> dict:
    request.state.ai_capability = "ai-gateway-registry"
    return registry_snapshot()


@router.get("/advisory-evaluation-policy", dependencies=[Depends(require_service_key)])
def get_advisory_evaluation_policy(request: Request) -> dict:
    request.state.ai_capability = "ai-gateway-advisory-evaluation-policy"
    return evaluation_policy_snapshot()


@router.post(
    "/evaluate-advisory",
    response_model=AdvisoryEvaluationResponse,
    dependencies=[Depends(require_service_key)],
)
def evaluate_advisory_candidate(payload: AdvisoryEvaluationRequest, request: Request) -> AdvisoryEvaluationResponse:
    request.state.ai_capability = "ai-gateway-advisory-evaluation"
    return evaluate_advisory(payload)


@router.post(
    "/plan",
    response_model=GatewayPlanResponse,
    dependencies=[Depends(require_service_key)],
)
def plan_gateway_execution(payload: GatewayPlanRequest, request: Request) -> GatewayPlanResponse:
    request.state.ai_capability = "ai-gateway-plan"
    tool = _registered_tool_or_error(payload)
    evidence_contract = str(tool.get("evidenceContract", ""))
    return GatewayPlanResponse(
        registry_version=REGISTRY_VERSION,
        tool_key=str(tool["key"]),
        route=str(tool["route"]),
        mode=str(tool["mode"]),
        evidence_contract=evidence_contract,
        evidence_accepted=True,
        fact_count=len(payload.evidence.facts),
        provenance_count=len(payload.evidence.provenance),
        execution_authorised=False,
        external_write_authorised=False,
        human_approval_required=bool(tool.get("humanApprovalRequired", True)),
        message=(
            "Evidence is contract-valid and the capability is registered. "
            "This endpoint creates a governance plan only; it does not execute inference, train or promote a model, or perform an external action."
        ),
    )


@router.post(
    "/management-analysis",
    response_model=ManagementBiAnalysisResponse,
    dependencies=[Depends(require_service_key)],
)
def management_analysis(payload: ManagementBiAnalysisRequest, request: Request) -> ManagementBiAnalysisResponse:
    request.state.ai_capability = "management-bi-statistical-analysis"
    _management_tool_or_error(payload)
    return analyse_management_bi(payload)


@router.post(
    "/advisory-preview",
    response_model=GatewayAdvisoryResponse,
    dependencies=[Depends(require_service_key)],
)
def advisory_preview(payload: GatewayPlanRequest, request: Request) -> GatewayAdvisoryResponse:
    request.state.ai_capability = "ai-gateway-advisory-preview"
    tool = _registered_tool_or_error(payload)
    if str(tool.get("key")) != "marketing-insights":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "AI_ADVISORY_BASELINE_NOT_IMPLEMENTED",
                "message": "The deterministic advisory baseline is currently implemented only for Marketing Insights.",
            },
        )
    if payload.requested_action == "forecast":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "AI_ADVISORY_FORECAST_REQUIRES_GOVERNED_MODEL",
                "message": "Forecasting remains planning-only until a governed predictive model has passed baseline comparison and promotion gates.",
            },
        )
    return build_canonical_advisory(payload)
