import AiPrediction from "../../ai/AiPrediction.js";
import Customer from "../../../models/customer.js";
import RetentionJourney, {
  RETENTION_CHANNELS,
  RETENTION_STOP_CONDITIONS,
  RETENTION_TRIGGERS,
} from "./RetentionJourney.js";

const RETENTION_RISK_LEVELS = Object.freeze([
  "low",
  "medium",
  "high",
]);

function text(value, maximumLength = 5000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function integer(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed)
  );
}

function number(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsed)
  );
}

function requiredChoice(
  value,
  choices,
  fieldName
) {
  const normalised = text(value, 100).toLowerCase();

  if (!choices.includes(normalised)) {
    const error = new Error(
      fieldName +
        " must be one of: " +
        choices.join(", ") +
        "."
    );
    error.statusCode = 400;
    throw error;
  }

  return normalised;
}

export function normaliseRetentionConditions(
  value = {}
) {
  const source =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {};

  const retentionRiskLevels = Array.from(
    new Set(
      (
        Array.isArray(source.retentionRiskLevels)
          ? source.retentionRiskLevels
          : []
      )
        .map((item) =>
          text(item, 20).toLowerCase()
        )
        .filter((item) =>
          RETENTION_RISK_LEVELS.includes(item)
        )
    )
  );

  return {
    inactiveDays: integer(
      source.inactiveDays,
      60,
      1,
      730
    ),
    minimumVisits: integer(
      source.minimumVisits,
      0,
      0,
      1000
    ),
    minimumLifetimeValue: number(
      source.minimumLifetimeValue,
      0,
      0,
      10000000
    ),
    retentionRiskLevels,
  };
}

export function normaliseRetentionSteps(
  value
) {
  if (!Array.isArray(value)) {
    const error = new Error(
      "Retention journey steps must be an array."
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    value.length < 1 ||
    value.length > 10
  ) {
    const error = new Error(
      "A retention journey must contain between 1 and 10 steps."
    );
    error.statusCode = 400;
    throw error;
  }

  return value.map((step, index) => {
    const body = text(
      step?.body,
      5000
    );

    if (!body) {
      const error = new Error(
        "Every retention journey step requires a message body."
      );
      error.statusCode = 400;
      throw error;
    }

    const channel = requiredChoice(
      step?.channel,
      RETENTION_CHANNELS,
      "Step channel"
    );

    return {
      order: index + 1,
      delayMinutes: integer(
        step?.delayMinutes,
        0,
        0,
        525600
      ),
      channel,
      subject:
        channel === "email"
          ? text(step?.subject, 240)
          : "",
      body,
      stopIf: requiredChoice(
        step?.stopIf || "none",
        RETENTION_STOP_CONDITIONS,
        "Step stop condition"
      ),
    };
  });
}

export function normaliseRetentionJourneyPayload(
  payload = {},
  {
    partial = false,
  } = {}
) {
  const result = {};

  if (
    !partial ||
    Object.prototype.hasOwnProperty.call(
      payload,
      "name"
    )
  ) {
    const name = text(
      payload.name,
      120
    );

    if (name.length < 2) {
      const error = new Error(
        "Journey name must contain at least 2 characters."
      );
      error.statusCode = 400;
      throw error;
    }

    result.name = name;
  }

  if (
    !partial ||
    Object.prototype.hasOwnProperty.call(
      payload,
      "description"
    )
  ) {
    result.description = text(
      payload.description,
      600
    );
  }

  if (
    !partial ||
    Object.prototype.hasOwnProperty.call(
      payload,
      "trigger"
    )
  ) {
    result.trigger = requiredChoice(
      payload.trigger,
      RETENTION_TRIGGERS,
      "Journey trigger"
    );
  }

  if (
    !partial ||
    Object.prototype.hasOwnProperty.call(
      payload,
      "conditions"
    )
  ) {
    result.conditions =
      normaliseRetentionConditions(
        payload.conditions
      );
  }

  if (
    !partial ||
    Object.prototype.hasOwnProperty.call(
      payload,
      "steps"
    )
  ) {
    result.steps =
      normaliseRetentionSteps(
        payload.steps
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      payload,
      "enabled"
    )
  ) {
    result.enabled =
      payload.enabled === true;
  }

  return result;
}

export async function listRetentionJourneys() {
  return RetentionJourney.find()
    .sort({
      enabled: -1,
      updatedAt: -1,
      createdAt: -1,
    })
    .lean();
}

export async function createRetentionJourney(
  payload,
  actorId = null
) {
  const normalised =
    normaliseRetentionJourneyPayload(
      payload
    );

  return RetentionJourney.create({
    ...normalised,
    enabled: false,
    createdBy: actorId,
    updatedBy: actorId,
  });
}

export async function updateRetentionJourney(
  journeyId,
  payload,
  actorId = null
) {
  const normalised =
    normaliseRetentionJourneyPayload(
      payload,
      {
        partial: true,
      }
    );

  const journey =
    await RetentionJourney.findById(
      journeyId
    );

  if (!journey) {
    const error = new Error(
      "Retention journey not found."
    );
    error.statusCode = 404;
    throw error;
  }

  for (const [
    key,
    value,
  ] of Object.entries(
    normalised
  )) {
    journey[key] = value;
  }

  journey.updatedBy =
    actorId || journey.updatedBy;

  await journey.save();

  return journey;
}


function retentionPreviewError(
  message,
  statusCode
) {
  const error =
    new Error(message);
  error.statusCode =
    statusCode;
  return error;
}

export function buildInactiveRetentionPreviewPipeline({
  conditions,
  now = new Date(),
  limit = 50,
  aiPredictionCollection =
    AiPrediction.collection.name,
} = {}) {
  const safeConditions =
    normaliseRetentionConditions(
      conditions
    );

  const safeLimit =
    integer(
      limit,
      50,
      1,
      100
    );

  const cutoff =
    new Date(
      now.getTime() -
        safeConditions
          .inactiveDays *
          86400000
    );

  const riskLevels =
    safeConditions
      .retentionRiskLevels;

  const pipeline = [
    {
      $match: {
        status: "active",
        lastVisit: {
          $ne: null,
          $lt: cutoff,
        },
      },
    },
    {
      $addFields: {
        previewVisitCount: {
          $ifNull: [
            "$completedAppointmentCount",
            {
              $ifNull: [
                "$visitCount",
                0,
              ],
            },
          ],
        },
        previewLifetimeValue: {
          $ifNull: [
            "$totalSpent",
            0,
          ],
        },
      },
    },
    {
      $match: {
        previewVisitCount: {
          $gte:
            safeConditions
              .minimumVisits,
        },
        previewLifetimeValue: {
          $gte:
            safeConditions
              .minimumLifetimeValue,
        },
      },
    },
    {
      $lookup: {
        from:
          aiPredictionCollection,
        let: {
          customerId:
            "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      "$customer",
                      "$$customerId",
                    ],
                  },
                  {
                    $eq: [
                      "$predictionType",
                      "churn_risk",
                    ],
                  },
                  {
                    $gt: [
                      "$expiresAt",
                      now,
                    ],
                  },
                ],
              },
            },
          },
          {
            $sort: {
              updatedAt: -1,
            },
          },
          {
            $limit: 1,
          },
          {
            $project: {
              _id: 0,
              label: 1,
              score: 1,
              modelName: 1,
              modelVersion: 1,
              updatedAt: 1,
              expiresAt: 1,
            },
          },
        ],
        as:
          "retentionPrediction",
      },
    },
    {
      $unwind: {
        path:
          "$retentionPrediction",
        preserveNullAndEmptyArrays:
          true,
      },
    },
  ];

  if (riskLevels.length) {
    pipeline.push({
      $match: {
        "retentionPrediction.label": {
          $in: riskLevels,
        },
      },
    });
  }

  pipeline.push(
    {
      $addFields: {
        previewDaysInactive: {
          $dateDiff: {
            startDate:
              "$lastVisit",
            endDate: now,
            unit: "day",
          },
        },
      },
    },
    {
      $sort: {
        previewDaysInactive:
          -1,
        previewLifetimeValue:
          -1,
        _id: 1,
      },
    },
    {
      $facet: {
        summary: [
          {
            $count: "count",
          },
        ],
        items: [
          {
            $limit:
              safeLimit,
          },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              preferredName: 1,
              email: 1,
              phone: 1,
              lastVisit: 1,
              visits:
                "$previewVisitCount",
              lifetimeValue:
                "$previewLifetimeValue",
              daysInactive:
                "$previewDaysInactive",
              risk: {
                label:
                  "$retentionPrediction.label",
                score:
                  "$retentionPrediction.score",
                modelName:
                  "$retentionPrediction.modelName",
                modelVersion:
                  "$retentionPrediction.modelVersion",
                updatedAt:
                  "$retentionPrediction.updatedAt",
                expiresAt:
                  "$retentionPrediction.expiresAt",
              },
            },
          },
        ],
      },
    }
  );

  return {
    cutoff,
    limit:
      safeLimit,
    conditions:
      safeConditions,
    pipeline,
  };
}

export async function previewRetentionJourney(
  journeyId,
  {
    limit = 50,
  } = {}
) {
  const journey =
    await RetentionJourney
      .findById(
        journeyId
      )
      .lean();

  if (!journey) {
    throw retentionPreviewError(
      "Retention journey not found.",
      404
    );
  }

  const requiredChannels =
    Array.from(
      new Set(
        (
          journey.steps ||
          []
        )
          .map(
            (step) =>
              step.channel
          )
          .filter(Boolean)
      )
    );

  const baseResult = {
    dryRun: true,
    communicationQueued:
      false,
    previewedAt:
      new Date(),
    journey: {
      _id:
        journey._id,
      name:
        journey.name,
      trigger:
        journey.trigger,
      enabled:
        journey.enabled ===
        true,
    },
    requiredChannels,
  };

  if (
    journey.trigger !==
    "customer_inactive"
  ) {
    return {
      ...baseResult,
      supported: false,
      candidateCount: 0,
      returnedCount: 0,
      truncated: false,
      items: [],
      message:
        "Audience preview is currently implemented only for customer-inactive journeys. No communication was queued.",
    };
  }

  const built =
    buildInactiveRetentionPreviewPipeline({
      conditions:
        journey.conditions,
      now:
        baseResult.previewedAt,
      limit,
    });

  const [result] =
    await Customer.aggregate(
      built.pipeline
    );

  const items =
    Array.isArray(
      result?.items
    )
      ? result.items
      : [];

  const candidateCount =
    Number(
      result?.summary?.[0]
        ?.count
    ) || 0;

  return {
    ...baseResult,
    supported: true,
    conditions:
      built.conditions,
    cutoff:
      built.cutoff,
    candidateCount,
    returnedCount:
      items.length,
    truncated:
      candidateCount >
      items.length,
    items,
    message:
      "Dry-run preview only. Consent, suppression, idempotency and delivery checks remain mandatory before any future execution can queue communication.",
  };
}
