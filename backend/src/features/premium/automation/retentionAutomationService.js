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
