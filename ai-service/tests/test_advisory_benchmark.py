from datetime import datetime, timezone

from app.governance.advisory_evaluation import (
    AdvisoryEvaluationRequest,
    advisory_output_hash,
    evaluate_advisory,
    evaluation_policy_snapshot,
)
from app.schemas.ai_gateway import GatewayPlanRequest
from app.services.canonical_adviser import build_canonical_advisory


def benchmark_evidence(case_number: int) -> dict:
    day = 1 + (case_number % 25)
    previous_day = max(1, day - 1)
    google_clicks = 60 + (case_number * 5)
    meta_clicks = 40 + (case_number * 3)
    prior_conversions = 3 + (case_number % 7)
    latest_conversions = prior_conversions + 1 + (case_number % 4)
    record_count = 0 if case_number == 24 else 20 + case_number

    return {
        "contract": "data_hub_evidence_v1",
        "business_id": "business-benchmark",
        "location_id": f"location-{(case_number % 5) + 1:02d}",
        "evidence_id": f"benchmark-evidence-{case_number:02d}",
        "generated_at": datetime(2026, 10, 25, 12, 0, tzinfo=timezone.utc).isoformat(),
        "facts": [
            {"name": "total.recordCount", "value": record_count, "dimensions": {"scope": "query_total"}},
            {"name": "total.revenue", "value": 3000.0 + case_number * 250.0, "unit": "GBP", "dimensions": {"scope": "query_total"}},
            {"name": "clicks", "value": google_clicks, "dimensions": {"provider": "google_ads", "dateBucket": f"2026-10-{day:02d}"}},
            {"name": "clicks", "value": meta_clicks, "dimensions": {"provider": "meta_ads", "dateBucket": f"2026-10-{day:02d}"}},
            {"name": "conversions", "value": prior_conversions, "dimensions": {"provider": "google_ads", "dateBucket": f"2026-10-{previous_day:02d}"}},
            {"name": "conversions", "value": latest_conversions, "dimensions": {"provider": "google_ads", "dateBucket": f"2026-10-{day:02d}"}},
        ],
        "provenance": [
            {"source_type": "marketing_data_source", "source_id": f"google-{case_number:02d}", "provider": "google_ads"},
            {"source_type": "marketing_data_source", "source_id": f"meta-{case_number:02d}", "provider": "meta_ads"},
        ],
        "metadata": {"locationOwned": True, "benchmarkCase": case_number},
    }


def test_deterministic_adviser_passes_minimum_25_case_repeated_run_benchmark():
    policy = evaluation_policy_snapshot()
    minimum_cases = policy["minimumOfflineCases"]
    repetitions = policy["minimumRepeatedRunsPerCase"]
    assert minimum_cases == 25
    assert repetitions == 3

    passed = 0
    assessment_hashes = set()
    for case_number in range(minimum_cases):
        action = ("analyse", "summarise", "recommend")[case_number % 3]
        payload = GatewayPlanRequest(
            tool_key="marketing-insights",
            requested_action=action,
            evidence=benchmark_evidence(case_number),
        )
        outputs = [build_canonical_advisory(payload) for _ in range(repetitions)]
        hashes = [advisory_output_hash(output) for output in outputs]
        assert len(set(hashes)) == 1, f"case {case_number} was not exactly reproducible"

        assessment = evaluate_advisory(
            AdvisoryEvaluationRequest(
                evidence=payload.evidence,
                candidate=outputs[0],
                candidate_kind="deterministic_baseline",
                repeated_output_hashes=hashes,
            )
        )
        assert assessment.quality_gate_passed is True, (
            f"case {case_number} failed: {assessment.blockers}"
        )
        assert assessment.production_promotion_authorised is False
        assert assessment.production_inference_authorised is False
        assessment_hashes.add(assessment.assessment_hash)
        passed += 1

    assert passed == minimum_cases
    assert len(assessment_hashes) == minimum_cases
