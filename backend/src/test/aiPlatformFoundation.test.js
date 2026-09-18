import assert from "node:assert/strict";
import test from "node:test";

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

test("AI dataset registry defaults to temporal training governance", () => {
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
