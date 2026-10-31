from datetime import datetime, timezone


def valid_training_manifest(**overrides):
    payload = {
        "dataset_key": "appointments-history",
        "business_id": "business-123",
        "location_id": "location-001",
        "approved_purpose": "no_show_prediction",
        "feature_definition_version": "appointments-features-v1",
        "row_count": 1000,
        "sha256_fingerprint": "a" * 64,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "provenance_source_ids": ["appointments-export-001"],
        "contains_direct_identifiers": False,
        "contains_credentials": False,
    }
    payload.update(overrides)
    return payload


def test_ai_core_status_requires_service_key(client):
    response = client.get("/api/v1/ai-core/status")
    assert response.status_code == 401


def test_ai_core_status_exposes_governed_fail_closed_state(client, auth_headers):
    response = client.get("/api/v1/ai-core/status", headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert body["module"]["key"] == "ai"
    assert body["module"]["label"] == "AI Core"
    assert body["module"]["role"] == "shared_core_module"
    assert body["toolCount"] >= 10
    assert body["modelCount"] >= 2
    assert body["modelDevelopmentTrackCount"] >= 5
    assert body["trainingDatasetCount"] >= 8
    assert body["trainingEligibleDatasetCount"] >= 7
    assert body["restrictedDatasetCount"] >= 1
    assert body["policy"]["trainingDefault"] == "disabled"
    assert body["policy"]["productionTrainingAllowed"] is False
    assert body["policy"]["crossTenantTrainingDefault"] == "disabled"
    assert body["policy"]["automaticModelPromotionAllowed"] is False
    assert body["policy"]["humanApprovalRequiredForTraining"] is True
    assert body["policy"]["humanApprovalRequiredForPromotion"] is True
    assert body["policy"]["offlineTrainingOnly"] is True
    assert body["policy"]["repeatedRunsForStochasticModelsRequired"] is True
    assert body["state"] == "governed_foundation"


def test_ai_core_training_data_catalogue_is_tenant_scoped_and_restricted_by_default(
    client,
    auth_headers,
):
    response = client.get("/api/v1/ai-core/training-data", headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    datasets = {dataset["key"]: dataset for dataset in body["datasets"]}

    assert body["policy"]["businessAndLocationIsolationRequired"] is True
    assert body["policy"]["crossTenantTrainingDefault"] == "disabled"
    assert body["policy"]["directIdentifiersAllowed"] is False
    assert body["policy"]["rawCredentialsAllowed"] is False
    assert body["policy"]["datasetFingerprintRequired"] is True
    assert body["policy"]["provenanceRequired"] is True

    assert datasets["appointments-history"]["trainingEligible"] is True
    assert datasets["appointments-history"]["tenantScope"] == "business_and_location"
    assert datasets["customer-behaviour"]["personalData"] == "pseudonymised_only"
    assert datasets["clinical-records"]["trainingEligible"] is False
    assert datasets["clinical-records"]["personalData"] == "special_category"


def test_ai_core_validates_training_manifest_without_authorising_training(client, auth_headers):
    response = client.post(
        "/api/v1/ai-core/training-data/validate-manifest",
        headers=auth_headers,
        json=valid_training_manifest(),
    )
    assert response.status_code == 200

    body = response.json()
    assert body["accepted"] is True
    assert body["dataset_key"] == "appointments-history"
    assert body["approved_purpose"] == "no_show_prediction"
    assert body["training_authorised"] is False
    assert body["production_promotion_authorised"] is False
    assert body["provenance_count"] == 1


def test_ai_core_rejects_unapproved_training_purpose(client, auth_headers):
    response = client.post(
        "/api/v1/ai-core/training-data/validate-manifest",
        headers=auth_headers,
        json=valid_training_manifest(approved_purpose="retention_modelling"),
    )
    assert response.status_code == 409
    assert response.json()["code"] == "AI_TRAINING_PURPOSE_NOT_APPROVED"


def test_ai_core_rejects_restricted_training_dataset(client, auth_headers):
    response = client.post(
        "/api/v1/ai-core/training-data/validate-manifest",
        headers=auth_headers,
        json=valid_training_manifest(
            dataset_key="clinical-records",
            approved_purpose="no_show_prediction",
        ),
    )
    assert response.status_code == 409
    assert response.json()["code"] == "AI_TRAINING_DATASET_RESTRICTED"


def test_ai_core_rejects_direct_identifiers_and_credentials(client, auth_headers):
    identifiers = client.post(
        "/api/v1/ai-core/training-data/validate-manifest",
        headers=auth_headers,
        json=valid_training_manifest(contains_direct_identifiers=True),
    )
    assert identifiers.status_code == 422
    assert identifiers.json()["code"] == "AI_TRAINING_DIRECT_IDENTIFIERS_FORBIDDEN"

    credentials = client.post(
        "/api/v1/ai-core/training-data/validate-manifest",
        headers=auth_headers,
        json=valid_training_manifest(contains_credentials=True),
    )
    assert credentials.status_code == 422
    assert credentials.json()["code"] == "AI_TRAINING_CREDENTIALS_FORBIDDEN"


def test_ai_core_rejects_invalid_dataset_fingerprint(client, auth_headers):
    response = client.post(
        "/api/v1/ai-core/training-data/validate-manifest",
        headers=auth_headers,
        json=valid_training_manifest(sha256_fingerprint="not-a-sha256"),
    )
    assert response.status_code == 422


def test_ai_core_development_tracks_reference_only_approved_training_data(client, auth_headers):
    response = client.get("/api/v1/ai-core/development-tracks", headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    tracks = {track["key"]: track for track in body["tracks"]}

    assert body["policy"]["offlineTrainingOnly"] is True
    assert body["policy"]["trainingRequiresExplicitApproval"] is True
    assert body["policy"]["baselineComparisonRequired"] is True
    assert body["policy"]["holdoutEvaluationRequired"] is True
    assert body["policy"]["automaticTrainingAllowed"] is False
    assert body["policy"]["automaticProductionPromotionAllowed"] is False

    assert "appointments-history" in tracks["no-show-risk"]["approvedDatasets"]
    assert tracks["no-show-risk"]["calibrationRequired"] is True
    assert tracks["demand-forecasting"]["baseline"] == "seasonal_naive"
    assert "customer-behaviour" in tracks["retention-risk"]["approvedDatasets"]
    assert tracks["service-product-recommendation"]["taskType"] == "ranking"
    assert all(track["trainingAuthorised"] is False for track in body["tracks"])
    assert all(track["productionPromotionAuthorised"] is False for track in body["tracks"])
    assert all(
        "clinical-records" not in track["approvedDatasets"]
        for track in body["tracks"]
    )


def test_ai_core_models_endpoint_does_not_authorise_training_or_promotion(client, auth_headers):
    response = client.get("/api/v1/ai-core/models", headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert body["policy"]["trainingDefault"] == "disabled"
    assert body["policy"]["productionModelPromotionDefault"] == "disabled"
    assert body["policy"]["automaticModelPromotionAllowed"] is False
    assert all(model["trainingAuthorised"] is False for model in body["models"])
    assert all(model["productionPromotionAuthorised"] is False for model in body["models"])
