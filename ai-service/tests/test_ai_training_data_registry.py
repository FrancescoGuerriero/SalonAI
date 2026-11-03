from copy import deepcopy

from app.governance.ai_registry import registry_snapshot
from app.governance.training_data_registry import (
    registered_training_dataset,
    training_data_snapshot,
)


def test_training_data_catalogue_is_tenant_scoped_and_fail_closed():
    snapshot = training_data_snapshot()

    assert snapshot["version"] == "aiibp-training-data-v1"
    assert snapshot["policy"]["businessAndLocationIsolationRequired"] is True
    assert snapshot["policy"]["crossTenantTrainingDefault"] == "disabled"
    assert snapshot["policy"]["directIdentifiersAllowed"] is False
    assert snapshot["policy"]["rawCredentialsAllowed"] is False
    assert snapshot["policy"]["automaticTrainingAllowed"] is False
    assert snapshot["policy"]["productionTrainingAllowed"] is False
    assert snapshot["policy"]["automaticModelPromotionAllowed"] is False

    eligible = [item for item in snapshot["datasets"] if item["trainingEligible"]]
    assert eligible
    assert all(item["tenantScope"] == "business_and_location" for item in eligible)


def test_special_category_clinical_data_is_not_training_eligible_by_default():
    clinical = registered_training_dataset("clinical-records")

    assert clinical is not None
    assert clinical["personalData"] == "special_category"
    assert clinical["trainingEligible"] is False
    assert clinical["approvedPurposes"] == []


def test_training_registry_snapshots_are_mutation_safe():
    first = training_data_snapshot()
    expected = deepcopy(first)

    first["datasets"][0]["trainingEligible"] = False
    first["policy"]["crossTenantTrainingDefault"] = "enabled"

    assert training_data_snapshot() == expected


def test_ai_registry_exposes_ai_core_and_training_data_governance():
    snapshot = registry_snapshot()

    assert snapshot["version"] == "1.4.0"
    assert snapshot["module"]["key"] == "ai"
    assert snapshot["module"]["label"] == "AI Core"
    assert snapshot["module"]["role"] == "shared_core_module"
    assert snapshot["module"]["assistantModulesConsumeCore"] is True
    assert snapshot["trainingData"]["version"] == "aiibp-training-data-v1"
    assert snapshot["policy"]["trainingDefault"] == "disabled"
