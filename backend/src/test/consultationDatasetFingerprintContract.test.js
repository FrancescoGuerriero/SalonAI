import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintConsultationDataset,
} from "../features/consultations/consultationDatasetSnapshot.js";

const CONTRACT_VECTOR = {
  snapshotSchemaVersion: "consultation-dataset-snapshot-v1",
  recordSchemaVersion: "consultation-learning-v1",
  datasetVersion: "contract-vector-v1",
  source: {
    kind: "synthetic",
    approvalReference: "",
    directProductionDatabaseAccess: false,
  },
  usePolicy: "evaluation-only",
  records: [],
};

const EXPECTED_SHA256 =
  "801b11257a983e0d8edc3f5225390586dfb1ddfe676ad5d0b3816400698f8ee0";

test("consultation dataset fingerprint matches the shared Node/Python contract vector", () => {
  assert.equal(
    fingerprintConsultationDataset(CONTRACT_VECTOR),
    EXPECTED_SHA256
  );
});
