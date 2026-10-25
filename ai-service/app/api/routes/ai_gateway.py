from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.security import require_service_key
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
from app.services.canonical_adviser import build_canonical_advisory


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
                "message": (
                    "The requested capability does not accept this evidence contract."
                ),
            },
        )
    return tool


@router.get(
    "/registry",
    dependencies=[Depends(require_service_key)],
)
def get_registry(
    request: Request,
) -> dict:
    request.state.ai_capability = "ai-gateway-registry"
    return registry_snapshot()


@router.post(
    "/plan",
    response_model=GatewayPlanResponse,
    dependencies=[Depends(require_service_key)],
)
def plan_gateway_execution(
    payload: GatewayPlanRequest,
    request: Request,
) -> GatewayPlanResponse:
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
        human_approval_required=bool(
            tool.get("humanApprovalRequired", True)
        ),
        message=(
            "Evidence is contract-valid and the capability is registered. "
            "This endpoint creates a governance plan only; it does not execute inference, "
            "train or promote a model, or perform an external action."
        ),
    )


@router.post(
    "/advisory-preview",
    response_model=GatewayAdvisoryResponse,
    dependencies=[Depends(require_service_key)],
)
def advisory_preview(
    payload: GatewayPlanRequest,
    request: Request,
) -> GatewayAdvisoryResponse:
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
                "message": (
                    "Forecasting remains planning-only until a governed predictive model has passed baseline comparison and promotion gates."
                ),
            },
        )

    return build_canonical_advisory(payload)
