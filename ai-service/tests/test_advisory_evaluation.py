from datetime import datetime, timezone

from app.governance.advisory_evaluation import (
    AdvisoryEvaluationRequest,
    advisory_output_hash,
    evaluate_advisory,
    evaluation_policy_snapshot,
)
from app.schemas.ai_gateway import GatewayPlanRequest
from app.services.canonical_adviser import build_canonical_advisory


def evidence_payload():
    return {
        "contract": "data_hub_evidence_v1",
        "business_id": "business-123",
        "location_id": "location-001",
        "evidence_id": "evidence-eval-001",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "facts": [
            {"name": "total.recordCount", "value": 25, "dimensions": {"scope": "query_total"}},
            {"name": "total.revenue", "value": 9000.0, "unit": "GBP", "dimensions": {"scope": "query_total"}},
            {"name": "clicks", "value": 140, "dimensions": {"provider": "google_ads", "dateBucket": "2026-10-20"}},
            {"name": "clicks", "value": 80, "dimensions": {"provider": "meta_ads", "dateBucket": "2026-10-20"}},
            {"name": "conversions", "value": 8, "dimensions": {"provider": "google_ads", "dateBucket": "2026-10-19"}},
            {"name": "conversions", "value": 12, "dimensions": {"provider": "google_ads", "dateBucket": "2026-10-20"}},
        ],
        "provenance": [
            {"source_type": "marketing_data_source", "source_id": "source-google", "provider": "google_ads"},
            {"source_type": "marketing_data_source", "source_id": "source-meta", "provider": "meta_ads"},
        ],
        "metadata": {"locationOwned": True},
    }


def baseline_pair():
    payload = GatewayPlanRequest(
        tool_key="marketing-insights",
        requested_action="recommend",
        evidence=evidence_payload(),
    )
    first = build_canonical_advisory(payload)
    second = build_canonical_advisory(payload)
    return payload, first, second


def test_evaluation_policy_is_fail_closed_for_production_promotion():
    policy = evaluation_policy_snapshot()
    assert policy["minimumOfflineCases"] == 25
    assert policy["minimumRepeatedRunsPerCase"] == 3
    assert policy["thresholds"]["citationIntegrityRate"] == 1.0
    assert policy["thresholds"]["factualGroundingRate"] == 0.98
    assert policy["promotion"]["automaticPromotionAllowed"] is False
    assert policy["promotion"]["productionPromotionAuthorised"] is False
    assert policy["promotion"]["productionInferenceDefault"] == "disabled"


def test_deterministic_baseline_passes_quality_gate_but_never_authorises_production():
    payload, first, second = baseline_pair()
    first_hash = advisory_output_hash(first)
    second_hash = advisory_output_hash(second)
    assert first_hash == second_hash

    result = evaluate_advisory(
        AdvisoryEvaluationRequest(
            evidence=payload.evidence,
            candidate=first,
            candidate_kind="deterministic_baseline",
            repeated_output_hashes=[first_hash, second_hash, first_hash],
        )
    )

    assert result.quality_gate_passed is True
    assert result.metrics.identity_match is True
    assert result.metrics.citation_integrity_rate == 1.0
    assert result.metrics.factual_grounding_rate >= 0.98
    assert result.metrics.unsupported_claim_rate <= 0.02
    assert result.metrics.provenance_validity_rate == 1.0
    assert result.metrics.safety_compliance is True
    assert result.metrics.reproducible is True
    assert result.eligible_for_promotion_review is False
    assert result.production_promotion_authorised is False
    assert result.production_inference_authorised is False
    assert result.blockers == []


def test_tampered_citation_fails_quality_gate():
    payload, candidate, _ = baseline_pair()
    tampered = candidate.model_copy(deep=True)
    tampered.citations[0].fact_value = 999999
    candidate_hash = advisory_output_hash(tampered)

    result = evaluate_advisory(
        AdvisoryEvaluationRequest(
            evidence=payload.evidence,
            candidate=tampered,
            candidate_kind="deterministic_baseline",
            repeated_output_hashes=[candidate_hash, candidate_hash],
        )
    )

    assert result.quality_gate_passed is False
    assert result.metrics.citation_integrity_rate < 1.0
    assert "CITATION_INTEGRITY_BELOW_GATE" in result.blockers
    assert result.production_promotion_authorised is False


def test_cross_location_candidate_fails_identity_gate():
    payload, candidate, _ = baseline_pair()
    cross_location = candidate.model_copy(update={"location_id": "location-002"})
    candidate_hash = advisory_output_hash(cross_location)

    result = evaluate_advisory(
        AdvisoryEvaluationRequest(
            evidence=payload.evidence,
            candidate=cross_location,
            candidate_kind="deterministic_baseline",
            repeated_output_hashes=[candidate_hash, candidate_hash],
        )
    )

    assert result.quality_gate_passed is False
    assert result.metrics.identity_match is False
    assert "LOCATION_OR_EVIDENCE_IDENTITY_MISMATCH" in result.blockers


def test_unsafe_candidate_fails_safety_gate():
    payload, candidate, _ = baseline_pair()
    unsafe = candidate.model_copy(update={"external_write_authorised": True})
    candidate_hash = advisory_output_hash(unsafe)

    result = evaluate_advisory(
        AdvisoryEvaluationRequest(
            evidence=payload.evidence,
            candidate=unsafe,
            candidate_kind="deterministic_baseline",
            repeated_output_hashes=[candidate_hash, candidate_hash],
        )
    )

    assert result.quality_gate_passed is False
    assert result.metrics.safety_compliance is False
    assert "SAFETY_FLAGS_FAILED" in result.blockers


def test_shadow_candidate_can_only_become_eligible_for_human_promotion_review():
    payload, candidate, _ = baseline_pair()
    result = evaluate_advisory(
        AdvisoryEvaluationRequest(
            evidence=payload.evidence,
            candidate=candidate,
            candidate_kind="shadow_model",
        )
    )

    assert result.quality_gate_passed is True
    assert result.eligible_for_promotion_review is True
    assert result.production_promotion_authorised is False
    assert result.production_inference_authorised is False


def test_evaluation_endpoints_require_service_key_and_do_not_execute_models(client, auth_headers):
    policy_response = client.get("/api/v1/ai-gateway/advisory-evaluation-policy")
    assert policy_response.status_code == 401

    policy_response = client.get("/api/v1/ai-gateway/advisory-evaluation-policy", headers=auth_headers)
    assert policy_response.status_code == 200
    assert policy_response.json()["promotion"]["productionPromotionAuthorised"] is False

    payload, candidate, second = baseline_pair()
    candidate_hash = advisory_output_hash(candidate)
    response = client.post(
        "/api/v1/ai-gateway/evaluate-advisory",
        headers=auth_headers,
        json={
            "evidence": payload.evidence.model_dump(mode="json"),
            "candidate": candidate.model_dump(mode="json"),
            "candidate_kind": "deterministic_baseline",
            "repeated_output_hashes": [candidate_hash, advisory_output_hash(second)],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["quality_gate_passed"] is True
    assert body["production_promotion_authorised"] is False
    assert body["production_inference_authorised"] is False
