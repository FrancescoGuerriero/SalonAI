import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  clampAdviserEvaluationPeriodDays,
  normaliseAdviserEvaluationAggregate,
} from "../features/aiRecommendations/aiAdviserEvaluationService.js";

test("Adviser evaluation period is constrained to a safe reporting window", () => {
  assert.equal(
    clampAdviserEvaluationPeriodDays(
      undefined
    ),
    30
  );
  assert.equal(
    clampAdviserEvaluationPeriodDays(
      0
    ),
    1
  );
  assert.equal(
    clampAdviserEvaluationPeriodDays(
      500
    ),
    365
  );
  assert.equal(
    clampAdviserEvaluationPeriodDays(
      90.9
    ),
    90
  );
});

test("Adviser evaluation reports feedback, usefulness, outcomes and latency from aggregate counts", () => {
  const evaluation =
    normaliseAdviserEvaluationAggregate({
      periodDays:
        30,
      from:
        new Date(
          "2026-08-20T00:00:00.000Z"
        ),
      to:
        new Date(
          "2026-09-19T00:00:00.000Z"
        ),
      aggregate: {
        summary: [
          {
            total:
              20,
            rated:
              10,
            useful:
              8,
            notUseful:
              2,
            feedbackComments:
              3,
            outcomesObserved:
              5,
            averageLatencyMs:
              125.56,
          },
        ],
        models: [
          {
            _id: {
              modelName:
                "salonai-adviser-grounded",
              modelVersion:
                "v2-readonly-1",
              provider:
                "local",
            },
            total:
              20,
            rated:
              10,
            useful:
              8,
            notUseful:
              2,
            feedbackComments:
              3,
            outcomesObserved:
              5,
            averageLatencyMs:
              125.56,
          },
        ],
        contexts: [
          {
            _id:
              "/calendar",
            total:
              8,
            rated:
              4,
            useful:
              3,
            notUseful:
              1,
            outcomesObserved:
              2,
            averageLatencyMs:
              100,
          },
        ],
      },
    });

  assert.equal(
    evaluation.summary
      .feedbackCoveragePct,
    50
  );
  assert.equal(
    evaluation.summary
      .usefulRatePct,
    80
  );
  assert.equal(
    evaluation.summary
      .outcomeCoveragePct,
    25
  );
  assert.equal(
    evaluation.summary
      .averageLatencyMs,
    125.6
  );
  assert.equal(
    evaluation.models[0]
      .provider,
    "local"
  );
  assert.equal(
    evaluation.contexts[0]
      .contextPath,
    "/calendar"
  );
});

test("Adviser evaluation exposes aggregate evidence only and never enables automatic learning", () => {
  const evaluation =
    normaliseAdviserEvaluationAggregate({
      aggregate: {},
    });

  assert.deepEqual(
    evaluation.governance,
    {
      aggregateOnly:
        true,
      exposesPrompts:
        false,
      exposesAnswers:
        false,
      exposesActorIds:
        false,
      automaticTraining:
        false,
      automaticPromotion:
        false,
    }
  );
});

test("Adviser evaluation endpoint remains permission-governed and aggregate-only", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiRecommendationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );
  const service =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserEvaluationService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /\/adviser\/evaluation/
  );
  assert.match(
    routes,
    /evaluation"[\s\S]*?"ai:use"/
  );
  assert.doesNotMatch(
    service,
    /actorUserId[\s\S]*?\$group/
  );
  assert.match(
    service,
    /aggregateOnly/
  );
});
