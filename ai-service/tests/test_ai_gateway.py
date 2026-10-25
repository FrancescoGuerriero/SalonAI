from copy import deepcopy
from datetime import datetime, timezone

from app.governance.ai_registry import registry_snapshot


def evidence_payload(metadata=None):
    return {
        "contract": "data_hub_evidence_v1",
        "business_id": "business-123",
        "location_id": "location-001",
        "evidence_id": "evidence-123",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "facts": [
            {
                "name": "revenue",
                "value": 12500.0,
                "unit": "GBP",
                "dimensions": {"period": "last_30_days"},
            },
            {
                "name": "roas",
                "value": 4.2,
                "dimensions": {"channel": "google_ads"},
            },
        ],
        "provenance": [
            {
                "source_type": "data_hub_view",
                "source_id": "view-123",
                "provider": "canonical",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "metadata": metadata or {"view": "marketing-executive", "locationOwned": True},
    }


def advisory_evidence_payload():
    evidence = evidence_payload()
    evidence["facts"] = [
        {
            "name": "total.recordCount",
            "value": 42,
            "dimensions": {"scope": "query_total"},
        },
        {
            "name": "total.revenue",
            "value": 12000.0,
            "unit": "GBP",
            "dimensions": {"scope": "query_total"},
        },
        {
            "name": "clicks",
            "value": 180,
            "dimensions": {"provider": "google_ads", "dateBucket": "2026-10-20"},
        },
        {
            "name": "clicks",
            "value": 90,
            "dimensions": {"provider": "meta_ads", "dateBucket": "2026-10-20"},
        },
        {
            "name": "conversions",
            "value": 10,
            "dimensions": {"provider": "google_ads", "dateBucket": "2026-10-19"},
        },
        {
            "name": "conversions",
            "value": 15,
            "dimensions": {"provider": "google_ads", "dateBucket": "2026-10-20"},
        },
    ]
    evidence["provenance"] = [
        {
            "source_type": "marketing_data_source",
            "source_id": "source-google",
            "provider": "google_ads",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "source_type": "marketing_data_source",
            "source_id": "source-meta",
            "provider": "meta_ads",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    return evidence


def test_registry_snapshot_is_mutation_safe_and_fail_closed():
    first = registry_snapshot()
    second = deepcopy(first)
    first["tools"][0]["externalWriteAllowed"] = True
    first["policy"]["trainingDefault"] = "enabled"

    fresh = registry_snapshot()
    assert fresh == second
    assert len(fresh["tools"]) == 10
    assert fresh["policy"]["externalWritesDefault"] == "disabled"
    assert fresh["policy"]["productionModelPromotionDefault"] == "disabled"
    assert fresh["policy"]["trainingDefault"] == "disabled"
    assert all(item["externalWriteAllowed"] is False for item in fresh["tools"])
    assert all(item["productionPromotionAuthorised"] is False for item in fresh["models"])


def test_registry_endpoint_requires_service_key(client):
    response = client.get("/api/v1/ai-gateway/registry")
    assert response.status_code == 401


def test_registry_endpoint_exposes_governed_existing_capabilities(client, auth_headers):
    response = client.get("/api/v1/ai-gateway/registry", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    by_key = {item["key"]: item for item in body["tools"]}
    assert len(by_key) == 10
    assert by_key["marketing-insights"]["authority"] == "aiibp_data_hub"
    assert by_key["marketing-insights"]["evidenceContract"] == "data_hub_evidence_v1"
    assert by_key["management-copilot"]["humanApprovalRequired"] is True
    assert body["policy"]["canonicalFactsRequired"] is True


def test_gateway_plan_accepts_location_owned_data_hub_evidence_but_does_not_execute(client, auth_headers):
    response = client.post(
        "/api/v1/ai-gateway/plan",
        headers=auth_headers,
        json={
            "tool_key": "marketing-insights",
            "requested_action": "analyse",
            "evidence": evidence_payload(),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["tool_key"] == "marketing-insights"
    assert body["evidence_contract"] == "data_hub_evidence_v1"
    assert body["evidence_accepted"] is True
    assert body["fact_count"] == 2
    assert body["provenance_count"] == 1
    assert body["execution_authorised"] is False
    assert body["external_write_authorised"] is False
    assert body["human_approval_required"] is True


def test_gateway_evidence_requires_location_identity(client, auth_headers):
    evidence = evidence_payload()
    evidence.pop("location_id")
    response = client.post(
        "/api/v1/ai-gateway/plan",
        headers=auth_headers,
        json={"tool_key": "marketing-insights", "evidence": evidence},
    )
    assert response.status_code == 422


def test_gateway_plan_rejects_unregistered_tool(client, auth_headers):
    response = client.post(
        "/api/v1/ai-gateway/plan",
        headers=auth_headers,
        json={
            "tool_key": "unknown-tool",
            "evidence": evidence_payload(),
        },
    )
    assert response.status_code == 404
    assert response.json()["code"] == "AI_TOOL_NOT_REGISTERED"


def test_gateway_plan_rejects_wrong_evidence_contract_for_registered_tool(client, auth_headers):
    response = client.post(
        "/api/v1/ai-gateway/plan",
        headers=auth_headers,
        json={
            "tool_key": "demand-forecasting",
            "requested_action": "forecast",
            "evidence": evidence_payload(),
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "AI_EVIDENCE_CONTRACT_MISMATCH"


def test_gateway_evidence_rejects_secret_like_metadata(client, auth_headers):
    response = client.post(
        "/api/v1/ai-gateway/plan",
        headers=auth_headers,
        json={
            "tool_key": "marketing-insights",
            "evidence": evidence_payload({"access_token": "must-never-enter-evidence"}),
        },
    )
    assert response.status_code == 422


def test_advisory_preview_generates_cited_deterministic_location_recommendations(client, auth_headers):
    response = client.post(
        "/api/v1/ai-gateway/advisory-preview",
        headers=auth_headers,
        json={
            "tool_key": "marketing-insights",
            "requested_action": "recommend",
            "evidence": advisory_evidence_payload(),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["tool_key"] == "marketing-insights"
    assert body["location_id"] == "location-001"
    assert body["deterministic_baseline"] is True
    assert body["model_inference_executed"] is False
    assert body["execution_authorised"] is False
    assert body["external_write_authorised"] is False
    assert body["human_approval_required"] is True
    assert body["provenance_source_ids"] == ["source-google", "source-meta"]
    assert any(item["category"] == "observation" for item in body["items"])
    assert any(item["category"] == "recommendation" for item in body["items"])
    assert all(citation["evidence_id"] == "evidence-123" for citation in body["citations"])
    assert all(item["fact_index"] >= 0 for item in body["citations"])


def test_advisory_preview_keeps_forecasting_behind_model_promotion_gate(client, auth_headers):
    response = client.post(
        "/api/v1/ai-gateway/advisory-preview",
        headers=auth_headers,
        json={
            "tool_key": "marketing-insights",
            "requested_action": "forecast",
            "evidence": advisory_evidence_payload(),
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "AI_ADVISORY_FORECAST_REQUIRES_GOVERNED_MODEL"


def test_advisory_preview_requires_service_key(client):
    response = client.post(
        "/api/v1/ai-gateway/advisory-preview",
        json={
            "tool_key": "marketing-insights",
            "requested_action": "analyse",
            "evidence": advisory_evidence_payload(),
        },
    )
    assert response.status_code == 401
