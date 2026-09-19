import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNoShowModelEvaluation,
  calibrationMetrics,
  clampNoShowEvaluationPeriodDays,
  probabilityDriftMetrics,
} from "../features/aiPlatform/noShowEvaluationService.js";

function row(
  probability,
  label
) {
  return {
    prediction: {
      probability,
      riskLevel:
        probability >=
        0.65
          ? "high"
          : probability >=
              0.35
            ? "medium"
            : "low",
    },
    outcome: {
      noShowLabel:
        label,
    },
  };
}

test("no-show evaluation period remains bounded", () => {
  assert.equal(
    clampNoShowEvaluationPeriodDays(
      undefined
    ),
    90
  );
  assert.equal(
    clampNoShowEvaluationPeriodDays(
      1
    ),
    7
  );
  assert.equal(
    clampNoShowEvaluationPeriodDays(
      500
    ),
    365
  );
});

test("calibration metrics calculate observed rate and Brier score from linked outcomes", () => {
  const metrics =
    calibrationMetrics([
      row(
        0.8,
        1
      ),
      row(
        0.6,
        1
      ),
      row(
        0.2,
        0
      ),
      row(
        0.4,
        0
      ),
    ]);

  assert.equal(
    metrics.sampleCount,
    4
  );
  assert.equal(
    metrics.positiveCount,
    2
  );
  assert.equal(
    metrics.observedNoShowRate,
    0.5
  );
  assert.equal(
    metrics.meanPredictedProbability,
    0.5
  );
  assert.equal(
    metrics.brierScore,
    0.1
  );
  assert.equal(
    metrics.bins.length,
    5
  );
});

test("probability drift remains unavailable until both windows have enough labelled outcomes", () => {
  const drift =
    probabilityDriftMetrics({
      current: [
        row(
          0.8,
          1
        ),
      ],
      reference: [
        row(
          0.2,
          0
        ),
      ],
    });

  assert.equal(
    drift.status,
    "insufficient_data"
  );
  assert.equal(
    drift.reviewRequired,
    false
  );
});

test("probability drift detects a material distribution shift using internal heuristics", () => {
  const current =
    Array.from(
      {
        length:
          30,
      },
      () =>
        row(
          0.85,
          1
        )
    );
  const reference =
    Array.from(
      {
        length:
          30,
      },
      () =>
        row(
          0.15,
          0
        )
    );

  const drift =
    probabilityDriftMetrics({
      current,
      reference,
    });

  assert.equal(
    drift.status,
    "significant_shift"
  );
  assert.equal(
    drift.reviewRequired,
    true
  );
  assert.ok(
    drift.populationStabilityIndex >
      0.25
  );
  assert.ok(
    drift.meanProbabilityShift >
      0.1
  );
});

test("model evaluation never converts monitoring evidence into automatic lifecycle changes", () => {
  const current =
    Array.from(
      {
        length:
          30,
      },
      (
        _,
        index
      ) =>
        row(
          index % 2
            ? 0.7
            : 0.2,
          index % 2
            ? 1
            : 0
        )
    );

  const evaluation =
    buildNoShowModelEvaluation({
      modelName:
        "salonai-no-show-risk-rules-v1",
      modelVersion:
        "v1",
      current,
      reference:
        current,
    });

  assert.equal(
    evaluation.lifecycleEvidence
      .reviewReady,
    true
  );
  assert.equal(
    evaluation.lifecycleEvidence
      .automaticPromotion,
    false
  );
  assert.equal(
    evaluation.lifecycleEvidence
      .automaticActivation,
    false
  );
});


test("calibration ignores missing labels and probabilities instead of coercing null to zero", () => {
  const metrics =
    calibrationMetrics([
      {
        prediction: {
          probability:
            null,
        },
        outcome: {
          noShowLabel:
            0,
        },
      },
      {
        prediction: {
          probability:
            0.5,
        },
        outcome: {
          noShowLabel:
            null,
        },
      },
      row(
        0.7,
        1
      ),
    ]);

  assert.equal(
    metrics.sampleCount,
    1
  );
  assert.equal(
    metrics.positiveCount,
    1
  );
});
