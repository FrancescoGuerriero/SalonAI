import assert from "node:assert/strict";
import test from "node:test";

import {
  normaliseNoShowModelEvidence,
} from "../features/aiPlatform/noShowModelEvidenceService.js";

test("no-show model evidence keeps candidate models explicitly non-production", () => {
  const evidence =
    normaliseNoShowModelEvidence({
      name:
        "salonai-no-show-risk-ml",
      version:
        "experiment-001",
      task:
        "no_show_prediction",
      lifecycle:
        "candidate",
      featureVersion:
        "no-show-v1",
      algorithm:
        "logistic_regression",
      metrics: {
        test: {
          roc_auc: 0.78,
          pr_auc: 0.42,
          brier_score: 0.16,
          precision: 0.51,
          recall: 0.67,
          threshold: 0.31,
        },
        baseline: {
          rules_model:
            "salonai-no-show-risk-rules-v1",
          rules_test: {
            roc_auc: 0.69,
            pr_auc: 0.33,
            brier_score: 0.19,
            precision: 0.44,
            recall: 0.59,
            threshold: 0.35,
          },
        },
      },
      limitations: [
        "Candidate only.",
      ],
      artifactUri:
        "C:/private/model.joblib",
      trainingDataset:
        "private-dataset-id",
    });

  assert.equal(
    evidence.lifecycle,
    "candidate"
  );
  assert.equal(
    evidence.productionActive,
    false
  );
  assert.equal(
    evidence.experimental,
    true
  );
  assert.equal(
    evidence.comparison
      .beatsRulesBaseline,
    true
  );
  assert.equal(
    evidence.testMetrics
      .prAuc,
    0.42
  );
  assert.equal(
    evidence.rulesBaseline
      .metrics.prAuc,
    0.33
  );

  const serialised =
    JSON.stringify(
      evidence
    );

  assert.equal(
    serialised.includes(
      "artifactUri"
    ),
    false
  );
  assert.equal(
    serialised.includes(
      "private/model.joblib"
    ),
    false
  );
  assert.equal(
    serialised.includes(
      "trainingDataset"
    ),
    false
  );
});

test("no-show model evidence only marks production lifecycle as active production inference", () => {
  const evidence =
    normaliseNoShowModelEvidence({
      name:
        "salonai-no-show-risk-ml",
      version:
        "approved-001",
      task:
        "no_show_prediction",
      lifecycle:
        "approved",
      metrics: {},
    });

  assert.equal(
    evidence.productionActive,
    false
  );
  assert.equal(
    evidence.experimental,
    true
  );

  const production =
    normaliseNoShowModelEvidence({
      name:
        "salonai-no-show-risk-ml",
      version:
        "production-001",
      task:
        "no_show_prediction",
      lifecycle:
        "production",
      metrics: {},
    });

  assert.equal(
    production
      .productionActive,
    true
  );
  assert.equal(
    production.experimental,
    false
  );
});

test("no-show model evidence rejects records for other AI tasks", () => {
  assert.equal(
    normaliseNoShowModelEvidence({
      name:
        "other-model",
      version: "v1",
      task:
        "demand_forecasting",
    }),
    null
  );
});
