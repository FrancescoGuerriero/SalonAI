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
    assert body["trainingDatasetCount"] >= 8
    assert body["trainingEligibleDatasetCount"] >= 7
    assert body["restrictedDatasetCount"] >= 1
    assert body["policy"]["trainingDefault"] == "disabled"
    assert body["policy"]["productionTrainingAllowed"] is False
    assert body["policy"]["crossTenantTrainingDefault"] == "disabled"
    assert body["policy"]["automaticModelPromotionAllowed"] is False
    assert body["policy"]["humanApprovalRequiredForTraining"] is True
    assert body["policy"]["humanApprovalRequiredForPromotion"] is True
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


def test_ai_core_models_endpoint_does_not_authorise_training_or_promotion(client, auth_headers):
    response = client.get("/api/v1/ai-core/models", headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert body["policy"]["trainingDefault"] == "disabled"
    assert body["policy"]["productionModelPromotionDefault"] == "disabled"
    assert body["policy"]["automaticModelPromotionAllowed"] is False
    assert all(model["trainingAuthorised"] is False for model in body["models"])
    assert all(model["productionPromotionAuthorised"] is False for model in body["models"])
