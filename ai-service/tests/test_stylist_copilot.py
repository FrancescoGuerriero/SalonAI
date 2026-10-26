from app.schemas.stylist_copilot import StylistCopilotRequest
from app.services.stylist_copilot import build_stylist_copilot


def _payload(**overrides):
    payload = {
        "capability": "stylist_copilot",
        "definitionVersion": "1",
        "tenantContext": {"businessId": "business-1", "locationId": "location-1"},
        "actorContext": {
            "actorId": "stylist-1",
            "role": "Stylist",
            "professionalDecisionOwner": True,
        },
        "appointment": {"serviceName": "Balayage", "startsAt": "2026-10-27T10:00:00Z"},
        "consultation": {
            "desiredOutcome": "lighter balayage",
            "hairCondition": "healthy",
        },
        "preferences": {"finish": "soft waves"},
        "previousServices": [{"serviceName": "Highlights", "date": "2026-08-10"}],
        "previousProducts": [{"productName": "Colour Protect Shampoo"}],
        "followUp": [{"title": "Colour maintenance review"}],
        "consentedContextKeys": [],
        "constraints": {
            "humanReviewRequired": True,
            "canonicalWritesAllowed": False,
            "autonomousCustomerMessagingAllowed": False,
            "medicalDiagnosisAllowed": False,
            "safetyRuleOverrideAllowed": False,
        },
    }
    payload.update(overrides)
    return StylistCopilotRequest.model_validate(payload)


def test_builds_professional_decision_support_without_actions():
    result = build_stylist_copilot(_payload(), provider_mode="mock")

    assert result.capability == "stylist_copilot"
    assert result.pre_appointment_brief
    assert result.consultation_summary
    assert result.history_summary
    assert result.recommendations
    assert all(item.advisory_only is True for item in result.recommendations)
    assert all(item.requires_professional_review is True for item in result.recommendations)
    assert result.safety_boundary.human_review_required is True
    assert result.safety_boundary.canonical_writes_performed is False
    assert result.safety_boundary.autonomous_messages_sent is False
    assert result.safety_boundary.safety_override_performed is False
    assert result.safety_boundary.medical_diagnosis_performed is False


def test_withholds_unconsented_sensitive_context():
    request = _payload(
        consultation={
            "desiredOutcome": "root colour",
            "sensitivities": "reported reaction to colour product",
        }
    )

    result = build_stylist_copilot(request)

    rendered = " ".join(result.consultation_summary).lower()
    assert "reported reaction" not in rendered
    assert any("withheld" in flag.lower() for flag in result.attention_flags)


def test_surfaces_consented_safety_context_without_overriding_rules():
    request = _payload(
        consultation={
            "desiredOutcome": "root colour",
            "sensitivities": "reported reaction to colour product",
        },
        consentedContextKeys=["sensitivities"],
    )

    result = build_stylist_copilot(request)

    rendered = " ".join(result.consultation_summary).lower()
    assert "reported reaction" in rendered
    assert any("safety-relevant" in flag.lower() for flag in result.attention_flags)
    assert result.safety_boundary.safety_override_performed is False
