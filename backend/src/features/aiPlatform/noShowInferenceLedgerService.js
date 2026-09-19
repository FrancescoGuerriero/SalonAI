import AiInferenceLog from "./AiInferenceLog.js";

const CAPABILITY =
  "no-show-prediction";
const FEATURE_VERSION =
  "no-show-v1";
const DEFAULT_MODEL_NAME =
  "salonai-no-show-risk-rules-v1";
const DEFAULT_MODEL_VERSION =
  "v1";
const TERMINAL_STATUSES =
  new Set([
    "completed",
    "cancelled",
    "no_show",
  ]);

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

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

function modelVersion(
  metadata = {}
) {
  const explicit =
    text(
      metadata.model_version
    );

  if (explicit) {
    return explicit;
  }

  const name =
    text(
      metadata.model_name
    );
  const match =
    name.match(
      /-v(\d+)$/i
    );

  return match
    ? `v${match[1]}`
    : DEFAULT_MODEL_VERSION;
}

export function buildNoShowInferenceDocuments({
  prediction,
  requestId = "",
  actorRole = "",
  actorUserId = null,
  latencyMs = 0,
} = {}) {
  const metadata =
    prediction?.metadata ||
    {};
  const modelName =
    text(
      metadata.model_name
    ) ||
    DEFAULT_MODEL_NAME;
  const version =
    modelVersion(
      metadata
    );
  const provider =
    text(
      metadata.provider_mode
    ) ||
    "unknown";

  return (
    prediction?.predictions ||
    []
  )
    .map(
      (item) => {
        const appointmentKey =
          text(
            item.appointment_key
          );

        if (
          !appointmentKey
        ) {
          return null;
        }

        return {
          capability:
            CAPABILITY,
          modelName,
          modelVersion:
            version,
          featureVersion:
            FEATURE_VERSION,
          entityType:
            "appointment",
          entityKey:
            appointmentKey,
          latencyMs:
            Math.max(
              0,
              finiteNumber(
                latencyMs
              )
            ),
          prediction: {
            probability:
              finiteNumber(
                item.probability
              ),
            riskLevel:
              text(
                item.risk_level
              ),
            appointmentDate:
              item.appointment_date ||
              null,
            provider,
          },
          confidence:
            Number.isFinite(
              Number(
                item.confidence
              )
            )
              ? Number(
                  item.confidence
                )
              : null,
          explanation: {
            riskFactors:
              Array.isArray(
                item.risk_factors
              )
                ? item.risk_factors
                : [],
            recommendedActions:
              Array.isArray(
                item.recommended_actions
              )
                ? item.recommended_actions
                : [],
            evaluation: {
              labelDefinition:
                "no_show=1, completed=0",
              cancellationExcluded:
                true,
            },
          },
          context: {
            requestId:
              text(
                requestId
              ),
            actorRole:
              text(
                actorRole
              ),
            actorUserId:
              actorUserId ||
              null,
            source:
              "no-show-prediction",
          },
        };
      }
    )
    .filter(Boolean);
}

export async function logNoShowPredictions(
  options = {}
) {
  const documents =
    buildNoShowInferenceDocuments(
      options
    );

  if (
    documents.length ===
    0
  ) {
    return {
      logged:
        0,
    };
  }

  await AiInferenceLog.insertMany(
    documents,
    {
      ordered:
        false,
    }
  );

  return {
    logged:
      documents.length,
  };
}

export function normaliseNoShowOutcome(
  appointment
) {
  const status =
    text(
      appointment?.status
    ).toLowerCase();

  if (
    !TERMINAL_STATUSES.has(
      status
    )
  ) {
    return null;
  }

  const appointmentKey =
    text(
      appointment?._id ||
      appointment?.id
    );

  if (
    !appointmentKey
  ) {
    return null;
  }

  const observedAt =
    (
      status ===
      "no_show"
        ? appointment.noShowAt
        : status ===
            "completed"
          ? appointment.completedAt
          : appointment.cancelledAt
    ) ||
    appointment.updatedAt ||
    new Date();

  return {
    appointmentKey,
    observedAt:
      new Date(
        observedAt
      ),
    outcome: {
      appointmentStatus:
        status,
      noShowLabel:
        status ===
        "no_show"
          ? 1
          : status ===
              "completed"
            ? 0
            : null,
      evaluationEligible:
        status ===
          "no_show" ||
        status ===
          "completed",
      cancellationExcluded:
        status ===
        "cancelled",
    },
  };
}

export async function observeNoShowOutcomeForAppointment(
  appointment
) {
  const observation =
    normaliseNoShowOutcome(
      appointment
    );

  if (
    !observation
  ) {
    return {
      matched:
        0,
      modified:
        0,
    };
  }

  const result =
    await AiInferenceLog.updateMany(
      {
        capability:
          CAPABILITY,
        entityType:
          "appointment",
        entityKey:
          observation
            .appointmentKey,
        requestedAt: {
          $lte:
            observation
              .observedAt,
        },
      },
      {
        $set: {
          outcome:
            observation.outcome,
          outcomeObservedAt:
            observation
              .observedAt,
        },
      }
    );

  return {
    matched:
      finiteNumber(
        result.matchedCount ??
          result.n
      ),
    modified:
      finiteNumber(
        result.modifiedCount ??
          result.nModified
      ),
  };
}

export {
  CAPABILITY as NO_SHOW_INFERENCE_CAPABILITY,
  FEATURE_VERSION as NO_SHOW_FEATURE_VERSION,
};

export default {
  buildNoShowInferenceDocuments,
  logNoShowPredictions,
  normaliseNoShowOutcome,
  observeNoShowOutcomeForAppointment,
};
