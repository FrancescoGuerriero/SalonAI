import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import AiFeatureSnapshot from "../features/aiPlatform/AiFeatureSnapshot.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439011";

test("tenant-scoped no-show snapshots validate with trusted Business ownership", async () => {
  const snapshot =
    new AiFeatureSnapshot({
      business:
        BUSINESS_ID,
      task:
        "no_show_prediction",
      entityType:
        "appointment",
      entityKey:
        "tenant-scoped-appointment",
      asOf:
        new Date(
          "2026-01-01T00:00:00Z"
        ),
      featureVersion:
        "no-show-v1",
      datasetVersion:
        "tenant-scope-test-v1",
      features: {},
    });

  await assert.doesNotReject(
    snapshot.validate()
  );
});

test("dataset build CLI requires an explicit trusted Business scope", async () => {
  const source =
    await readFile(
      new URL(
        "../../scripts/buildNoShowTrainingDataset.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /--business-id=<trusted Business ObjectId>/
  );
  assert.match(
    source,
    /materialiseTenantScopedNoShowTrainingDataset/
  );
  assert.doesNotMatch(
    source,
    /materialiseNoShowTrainingDataset\s*\(/
  );
});

test("tenant dataset materialiser filters canonical Appointments by Business before feature extraction", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiPlatform/tenantScopedNoShowTrainingDatasetService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /const appointmentFilter = \{[\s\S]*?business: scope\.businessId/
  );
  assert.match(
    source,
    /appointmentFilter\.location = scope\.locationId/
  );
  assert.match(
    source,
    /Location\.findOne\(\{[\s\S]*?business: businessObjectId/
  );
  assert.match(
    source,
    /AiFeatureSnapshot\.deleteMany\(\{[\s\S]*?business: scope\.businessId/
  );
  assert.match(
    source,
    /mode: "single_business"/
  );
});

test("legacy unscoped no-show snapshot deletion is blocked at the model boundary", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiPlatform/AiFeatureSnapshot.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /UNSCOPED_AI_TRAINING_DELETE_BLOCKED/
  );
  assert.match(
    source,
    /filter\?\.task === "no_show_prediction"[\s\S]*?!filter\?\.business/
  );
});
