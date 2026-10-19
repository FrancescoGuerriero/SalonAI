def base_payload():
    return {
        "capability": "consultation_assistance",
        "consultationType": "hair-colour-chemical",
        "definitionVersion": "1",
        "tenantContext": {
            "businessId": "business-123",
            "locationId": "location-456",
        },
        "features": {
            "desiredOutcome": "Copper colour change",
            "currentColour": "medium brown",
            "hairCondition": "good",
            "colourHistory": "none",
            "bleachHistory": "none",
            "sensitivities": "none",
            "hairLength": "shoulder length",
            "privateNotes": "must not cross the controlled feature boundary",
        },
        "deterministicAssessment": {
            "rulesetVersion": "hair-colour-chemical-rules-v1",
            "complete": True,
            "missingFields": [],
            "requiredHumanReview": True,
            "bookingBlocked": False,
            "flags": [],
        },
        "constraints": {
            "humanReviewRequired": True,
            "deterministicBookingBlock": False,
            "canonicalWritesAllowed": False,
            "medicalDiagnosisAllowed": False,
            "safetyRuleOverrideAllowed": False,
        },
    }


def test_consultation_assistance_is_structured_explainable_and_advisory(
    client, auth_headers
):
    response = client.post(
        "/api/v1/consultations/assist",
        headers=auth_headers,
        json=base_payload(),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["capability"] == "consultation_assistance"
    assert data["consultationType"] == "hair-colour-chemical"
    assert data["recommendation"]["advisoryOnly"] is True
    assert data["recommendation"]["bookingReady"] is False
    assert data["recommendation"]["serviceIntent"] == "colour_change_consultation"
    assert data["safetyBoundary"] == {
        "humanReviewRequired": True,
        "deterministicBookingBlock": False,
        "bookingAuthorised": False,
        "canonicalWritesPerformed": False,
        "safetyOverridePerformed": False,
        "medicalDiagnosisPerformed": False,
    }
    assert data["provenance"]["providerMode"] == "mock"
    assert data["provenance"]["modelName"] == "salonai-consultation-structured-baseline"
    assert data["provenance"]["modelVersion"] == "1"
    assert data["provenance"]["featureVersion"] == "hair-colour-consultation-features-v1"
    assert "privateNotes" not in data["extractedFeatures"]
    assert 0 <= data["confidence"] <= 1


def test_consultation_assistance_fails_closed_on_incomplete_information(
    client, auth_headers
):
    payload = base_payload()
    del payload["features"]["currentColour"]
    payload["deterministicAssessment"]["complete"] = False
    payload["deterministicAssessment"]["missingFields"] = ["currentColour"]
    payload["deterministicAssessment"]["bookingBlocked"] = True
    payload["constraints"]["deterministicBookingBlock"] = True

    response = client.post(
        "/api/v1/consultations/assist",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["recommendation"]["nextAction"] == "collect_more_information"
    assert data["recommendation"]["bookingReady"] is False
    assert "currentColour" in data["incompleteFields"]
    assert data["safetyBoundary"]["deterministicBookingBlock"] is True
    assert data["confidence"] <= 0.64


def test_reported_sensitivity_remains_blocking_and_requires_professional_review(
    client, auth_headers
):
    payload = base_payload()
    payload["features"]["sensitivities"] = "previous reaction to colour product"
    payload["deterministicAssessment"]["bookingBlocked"] = True
    payload["deterministicAssessment"]["flags"] = [
        {
            "code": "reported-sensitivity",
            "severity": "blocking",
            "label": "Professional review required.",
            "source": "rule",
        }
    ]
    payload["constraints"]["deterministicBookingBlock"] = True

    response = client.post(
        "/api/v1/consultations/assist",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["recommendation"]["nextAction"] == "professional_review_required"
    assert data["recommendation"]["inPersonConsultationRecommended"] is True
    assert data["safetyBoundary"]["bookingAuthorised"] is False
    assert any(
        item["severity"] == "blocking"
        for item in data["attentionFlags"]
    )


def test_consultation_endpoint_rejects_any_request_for_canonical_writes(
    client, auth_headers
):
    payload = base_payload()
    payload["constraints"]["canonicalWritesAllowed"] = True

    response = client.post(
        "/api/v1/consultations/assist",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_consultation_endpoint_requires_service_authentication(client):
    response = client.post(
        "/api/v1/consultations/assist",
        json=base_payload(),
    )

    assert response.status_code in {401, 403}
