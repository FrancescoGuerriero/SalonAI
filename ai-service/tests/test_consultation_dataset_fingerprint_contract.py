from app.services.consultation_dataset_evaluation import (
    consultation_dataset_fingerprint,
)


CONTRACT_VECTOR = {
    "manifest": {
        "snapshotSchemaVersion": "consultation-dataset-snapshot-v1",
        "recordSchemaVersion": "consultation-learning-v1",
        "datasetVersion": "contract-vector-v1",
        "source": {
            "kind": "synthetic",
            "approvalReference": "",
            "directProductionDatabaseAccess": False,
        },
        "usePolicy": "evaluation-only",
    },
    "records": [],
}

EXPECTED_SHA256 = "801b11257a983e0d8edc3f5225390586dfb1ddfe676ad5d0b3816400698f8ee0"


def test_consultation_dataset_fingerprint_matches_node_contract_vector():
    assert consultation_dataset_fingerprint(CONTRACT_VECTOR) == EXPECTED_SHA256
