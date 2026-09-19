import AiInferenceLog from "../aiPlatform/AiInferenceLog.js";

const CAPABILITY =
  "management-adviser";
const DEFAULT_PERIOD_DAYS =
  30;
const MAX_PERIOD_DAYS =
  365;

function finiteNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function percentage(
  numerator,
  denominator
) {
  if (
    !denominator
  ) {
    return 0;
  }

  return Number(
    (
      (
        finiteNumber(
          numerator
        ) /
        finiteNumber(
          denominator
        )
      ) *
      100
    ).toFixed(1)
  );
}

export function clampAdviserEvaluationPeriodDays(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.max(
    1,
    Math.min(
      MAX_PERIOD_DAYS,
      Math.trunc(
        number
      )
    )
  );
}

function summaryMetrics(
  source = {}
) {
  const total =
    finiteNumber(
      source.total
    );
  const rated =
    finiteNumber(
      source.rated
    );
  const useful =
    finiteNumber(
      source.useful
    );
  const notUseful =
    finiteNumber(
      source.notUseful
    );
  const feedbackComments =
    finiteNumber(
      source.feedbackComments
    );
  const outcomesObserved =
    finiteNumber(
      source.outcomesObserved
    );
  const averageLatencyMs =
    finiteNumber(
      source.averageLatencyMs
    );

  return {
    total,
    rated,
    useful,
    notUseful,
    feedbackComments,
    outcomesObserved,
    feedbackCoveragePct:
      percentage(
        rated,
        total
      ),
    usefulRatePct:
      percentage(
        useful,
        rated
      ),
    outcomeCoveragePct:
      percentage(
        outcomesObserved,
        total
      ),
    averageLatencyMs:
      Number(
        averageLatencyMs.toFixed(
          1
        )
      ),
  };
}

function modelMetrics(
  item = {}
) {
  const metrics =
    summaryMetrics(
      item
    );

  return {
    modelName:
      String(
        item._id
          ?.modelName ||
          ""
      ),
    modelVersion:
      String(
        item._id
          ?.modelVersion ||
          ""
      ),
    provider:
      String(
        item._id
          ?.provider ||
          "unknown"
      ),
    ...metrics,
  };
}

function contextMetrics(
  item = {}
) {
  const metrics =
    summaryMetrics(
      item
    );

  return {
    contextPath:
      String(
        item._id ||
          "global"
      ),
    ...metrics,
  };
}

export function normaliseAdviserEvaluationAggregate({
  aggregate = {},
  periodDays =
    DEFAULT_PERIOD_DAYS,
  from,
  to,
} = {}) {
  const summary =
    summaryMetrics(
      aggregate.summary
        ?.[0] || {}
    );

  return {
    capability:
      CAPABILITY,
    period: {
      days:
        clampAdviserEvaluationPeriodDays(
          periodDays
        ),
      from:
        from instanceof Date
          ? from.toISOString()
          : String(
              from || ""
            ),
      to:
        to instanceof Date
          ? to.toISOString()
          : String(
              to || ""
            ),
    },
    summary,
    models:
      (
        aggregate.models ||
        []
      ).map(
        modelMetrics
      ),
    contexts:
      (
        aggregate.contexts ||
        []
      ).map(
        contextMetrics
      ),
    governance: {
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
    },
  };
}

function metricAccumulator() {
  return {
    total: {
      $sum: 1,
    },
    rated: {
      $sum: {
        $cond: [
          {
            $in: [
              "$feedback.rating",
              [
                1,
                -1,
              ],
            ],
          },
          1,
          0,
        ],
      },
    },
    useful: {
      $sum: {
        $cond: [
          {
            $eq: [
              "$feedback.rating",
              1,
            ],
          },
          1,
          0,
        ],
      },
    },
    notUseful: {
      $sum: {
        $cond: [
          {
            $eq: [
              "$feedback.rating",
              -1,
            ],
          },
          1,
          0,
        ],
      },
    },
    feedbackComments: {
      $sum: {
        $cond: [
          {
            $gt: [
              {
                $strLenCP: {
                  $ifNull: [
                    "$feedback.comment",
                    "",
                  ],
                },
              },
              0,
            ],
          },
          1,
          0,
        ],
      },
    },
    outcomesObserved: {
      $sum: {
        $cond: [
          {
            $ifNull: [
              "$outcomeObservedAt",
              false,
            ],
          },
          1,
          0,
        ],
      },
    },
    averageLatencyMs: {
      $avg: {
        $ifNull: [
          "$latencyMs",
          0,
        ],
      },
    },
  };
}

export async function getAdviserEvaluation({
  periodDays =
    DEFAULT_PERIOD_DAYS,
  now =
    new Date(),
} = {}) {
  const safePeriodDays =
    clampAdviserEvaluationPeriodDays(
      periodDays
    );
  const to =
    now instanceof Date
      ? new Date(
          now
        )
      : new Date(
          now
        );
  const from =
    new Date(
      to.getTime() -
        safePeriodDays *
          24 *
          60 *
          60 *
          1000
    );
  const accumulators =
    metricAccumulator();

  const [aggregate] =
    await AiInferenceLog.aggregate(
      [
        {
          $match: {
            capability:
              CAPABILITY,
            requestedAt: {
              $gte:
                from,
              $lte:
                to,
            },
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id:
                    null,
                  ...accumulators,
                },
              },
            ],
            models: [
              {
                $group: {
                  _id: {
                    modelName:
                      "$modelName",
                    modelVersion:
                      "$modelVersion",
                    provider: {
                      $ifNull: [
                        "$prediction.provider",
                        "unknown",
                      ],
                    },
                  },
                  ...accumulators,
                },
              },
              {
                $sort: {
                  total:
                    -1,
                  "_id.modelName":
                    1,
                  "_id.modelVersion":
                    1,
                },
              },
            ],
            contexts: [
              {
                $group: {
                  _id: {
                    $ifNull: [
                      "$entityKey",
                      "global",
                    ],
                  },
                  ...accumulators,
                },
              },
              {
                $sort: {
                  total:
                    -1,
                  _id:
                    1,
                },
              },
              {
                $limit:
                  12,
              },
            ],
          },
        },
      ]
    );

  return normaliseAdviserEvaluationAggregate(
    {
      aggregate:
        aggregate || {},
      periodDays:
        safePeriodDays,
      from,
      to,
    }
  );
}

export default {
  clampAdviserEvaluationPeriodDays,
  getAdviserEvaluation,
  normaliseAdviserEvaluationAggregate,
};
