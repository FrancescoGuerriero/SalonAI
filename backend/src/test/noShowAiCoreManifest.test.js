import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNoShowAiCoreManifest,
} from "../features/aiPlatform/noShowAiCoreManifestService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439011";
const LOCATION_ID =
  "507f1f77bcf86cd799439012";

function dataset(overrides = {}) {
  return {
    name: "salonai-no-show",
    version: "no-show-dataset-v1",
    task: "no_show_prediction",
    featureVersion: "no-show-v1",
    status: "frozen",
    snapshotCount: 120,
    dataHash: "a".repeat(64),
    scope: {
      mode: "single_business",
      business: BUSINESS_ID,
      locations: [LOCATION_ID],
    },
    lineage: {
      sourceCollections: ["appointments"],
    },
    updatedAt: new Date("2026-10-27T19:00:00Z"),
    ...overrides,
  };
}

test("AI Core manifest is issued from one frozen Business/Location no-show dataset", () => {
  const manifest = buildNoShowAiCoreManifest(dataset());

  assert.equal(
    manifest.contract,
    "aiibp_training_dataset_manifest_v1"
  );
  assert.equal(
    manifest.dataset_key,
    "appointments-history"
  );
  assert.equal(
    manifest.business_id,
    BUSINESS_ID
  );
  assert.equal(
    manifest.location_id,
    LOCATION_ID
  );
  assert.equal(
    manifest.approved_purpose,
    "no_show_prediction"
  );
  assert.equal(
    manifest.feature_definition_version,
    "no-show-v1"
  );
  assert.equal(
    manifest.row_count,
    120
  );
  assert.equal(
    manifest.sha256_fingerprint,
    "a".repeat(64)
  );
  assert.equal(
    manifest.contains_direct_identifiers,
    false
  );
  assert.equal(
    manifest.contains_credentials,
    false
  );
  assert.deepEqual(
    manifest.provenance_source_ids,
    [
      "salonai-no-show:no-show-dataset-v1",
      "salonai-no-show:no-show-dataset-v1:appointments",
    ]
  );
});

test("AI Core manifest rejects multi-location datasets", () => {
  assert.throws(
    () =>
      buildNoShowAiCoreManifest(
        dataset({
          scope: {
            mode: "single_business",
            business: BUSINESS_ID,
            locations: [
              LOCATION_ID,
              "507f1f77bcf86cd799439013",
            ],
          },
        })
      ),
    (error) =>
      error.code ===
      "AI_TRAINING_DATASET_LOCATION_SCOPE_REQUIRED"
  );
});

test("AI Core manifest rejects missing dataset fingerprint", () => {
  assert.throws(
    () =>
      buildNoShowAiCoreManifest(
        dataset({
          dataHash: "",
        })
      ),
    (error) =>
      error.code ===
      "AI_TRAINING_DATASET_FINGERPRINT_REQUIRED"
  );
});

test("AI Core manifest rejects non-frozen datasets", () => {
  assert.throws(
    () =>
      buildNoShowAiCoreManifest(
        dataset({
          status: "draft",
        })
      ),
    (error) =>
      error.code ===
      "AI_TRAINING_DATASET_CONTRACT_MISMATCH"
  );
});
