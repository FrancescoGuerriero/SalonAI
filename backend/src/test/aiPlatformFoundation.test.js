import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";

import AiFeatureSnapshot from "../features/aiPlatform/AiFeatureSnapshot.js";
import AiInferenceLog from "../features/aiPlatform/AiInferenceLog.js";
import AiKnowledgeDocument from "../features/aiPlatform/AiKnowledgeDocument.js";
import AiModelVersion from "../features/aiPlatform/AiModelVersion.js";
import AiTrainingDataset from "../features/aiPlatform/AiTrainingDataset.js";

test("AI training foundation records time-aware versioned features without direct identifiers by default", () => {
  const snapshot =
    new AiFeatureSnapshot({
      task:
        "no_show_prediction",
      entityType:
        "appointment",
      entityKey:
        "pseudo-appointment-1",
      asOf:
        new Date(),
      featureVersion:
        "no-show-v1",
      features: {
        previousBookings: 4,
      },
    });

  assert.equal(
    snapshot.privacy
      .containsDirectIdentifiers,
    false
  );
  assert.equal(
    snapshot.privacy
      .pseudonymised,
    true
  );
  assert.equal(
    snapshot.split,
    "unassigned"
  );
});

test("AI feature snapshots expose additive trusted tenant provenance", () => {
  assert.ok(
    AiFeatureSnapshot.schema.path(
      "business"
    )
  );
  assert.ok(
    AiFeatureSnapshot.schema.path(
      "location"
    )
  );
  assert.ok(
    AiFeatureSnapshot.schema.path(
      "vertical"
    )
  );
});

test("AI dataset registry defaults to restrictive single-business temporal governance", () => {
  const dataset =
    new AiTrainingDataset({
      name:
        "no-show-training",
      version: "1",
      task:
        "no_show_prediction",
      featureVersion:
        "no-show-v1",
    });

  assert.equal(
    dataset.status,
    "draft"
  );
  assert.equal(
    dataset.splitStrategy.type,
    "temporal"
  );
  assert.equal(
    dataset.scope.mode,
    "single_business"
  );
  assert.equal(
    dataset.scope.deidentified,
    true
  );
});

test("single-business AI datasets require a trusted Business scope", async () => {
  const dataset =
    new AiTrainingDataset({
      name:
        "tenant-no-show-training",
      version: "1",
      task:
        "no_show_prediction",
      featureVersion:
        "no-show-v1",
    });

  await assert.rejects(
    dataset.validate(),
    /scope\.business/
  );

  dataset.scope.business =
    new mongoose.Types.ObjectId();

  await assert.doesNotReject(
    dataset.validate()
  );
});

test("cross-business AI datasets require de-identification and explicit governance", async () => {
  const dataset =
    new AiTrainingDataset({
      name:
        "platform-learning",
      version: "1",
      task:
        "no_show_prediction",
      featureVersion:
        "no-show-v1",
      scope: {
        mode:
          "cross_business_deidentified",
        deidentified: false,
      },
    });

  await assert.rejects(
    dataset.validate(),
    /scope\.(deidentified|governanceBasis)/
  );

  dataset.scope.deidentified =
    true;
  dataset.scope.governanceBasis =
    "Reviewed de-identified cross-business research dataset.";

  await assert.doesNotReject(
    dataset.validate()
  );
});

test("AI model registry separates experiments from production approval", () => {
  const model =
    new AiModelVersion({
      name:
        "no-show-risk",
      version: "experiment-1",
      task:
        "no_show_prediction",
      modelType:
        "classification",
    });

  assert.equal(
    model.lifecycle,
    "experiment"
  );
  assert.equal(
    model.approvedAt,
    null
  );
});

test("AI inference log captures outcome and usefulness feedback separately from prediction", () => {
  const inference =
    new AiInferenceLog({
      capability:
        "appointment-no-show",
      modelName:
        "rules-baseline",
      modelVersion: "1",
      prediction: {
        probability: 0.6,
      },
    });

  assert.equal(
    inference.outcome,
    null
  );
  assert.equal(
    inference.feedback.useful,
    null
  );
});

test("AI inference logs expose additive trusted tenant provenance", () => {
  assert.ok(
    AiInferenceLog.schema.path(
      "business"
    )
  );
  assert.ok(
    AiInferenceLog.schema.path(
      "location"
    )
  );
  assert.ok(
    AiInferenceLog.schema.path(
      "vertical"
    )
  );
});

test("AI knowledge documents carry audience and permission boundaries for Adviser retrieval", () => {
  const document =
    new AiKnowledgeDocument({
      sourceType:
        "salon_policy",
      sourceKey:
        "late-arrivals",
      title:
        "Late arrival policy",
      content:
        "Reviewed policy text",
      searchText:
        "Late arrival policy Reviewed policy text",
      audience: [
        "receptionist",
        "admin",
      ],
      requiredPermissions: [
        "appointment:read",
      ],
    });

  assert.deepEqual(
    document.audience,
    [
      "receptionist",
      "admin",
    ]
  );
  assert.deepEqual(
    document.requiredPermissions,
    [
      "appointment:read",
    ]
  );
});


test("canonical API router exposes the built-in Adviser through ai:use permission", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiRecommendationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /"\/management-copilot"[\s\S]*?"ai:use"[\s\S]*?getAiManagementCopilot/
  );
});
