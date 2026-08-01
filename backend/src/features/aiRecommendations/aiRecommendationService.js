import {
  getAiServiceHealth,
  getAiServiceReadiness,
  getHaircareRecommendation,
} from "../../services/aiMicroserviceClient.js";

export const HAIR_TYPES = Object.freeze([
  "straight",
  "wavy",
  "curly",
  "coily",
]);

export const HAIR_TEXTURES = Object.freeze([
  "fine",
  "medium",
  "coarse",
]);

export const HAIR_CONCERNS = Object.freeze([
  "dryness",
  "damage",
  "frizz",
  "oiliness",
  "colour_care",
  "scalp_sensitivity",
  "dandruff",
  "thinning",
  "breakage",
  "lack_of_volume",
]);

export const CHEMICAL_SERVICES = Object.freeze([
  "colour",
  "bleach",
  "relaxer",
  "perm",
  "keratin",
  "none",
]);

export const MAINTENANCE_PREFERENCES = Object.freeze([
  "low",
  "medium",
  "high",
]);

class AiRecommendationValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "AiRecommendationValidationError";
    this.code = "AI_RECOMMENDATION_VALIDATION_ERROR";
    this.status = 422;
    this.statusCode = 422;
    this.details = details;
  }
}

function normaliseText(value, maximumLength = 1000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function normaliseEnum(value, allowedValues, fieldName, fallback = null) {
  const normalised = normaliseText(value, 100).toLowerCase();

  if (!normalised && fallback !== null) {
    return fallback;
  }

  if (!allowedValues.includes(normalised)) {
    throw new AiRecommendationValidationError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}.`,
      {
        field: fieldName,
        allowedValues,
      }
    );
  }

  return normalised;
}

function normaliseEnumArray(
  value,
  allowedValues,
  fieldName,
  maximumItems
) {
  const values = Array.isArray(value) ? value : [];
  const uniqueValues = [
    ...new Set(
      values
        .map((item) => normaliseText(item, 100).toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (uniqueValues.length > maximumItems) {
    throw new AiRecommendationValidationError(
      `${fieldName} cannot contain more than ${maximumItems} items.`,
      {
        field: fieldName,
        maximumItems,
      }
    );
  }

  const invalidValues = uniqueValues.filter(
    (item) => !allowedValues.includes(item)
  );

  if (invalidValues.length > 0) {
    throw new AiRecommendationValidationError(
      `${fieldName} contains unsupported values: ${invalidValues.join(", ")}.`,
      {
        field: fieldName,
        invalidValues,
        allowedValues,
      }
    );
  }

  return uniqueValues;
}

function normaliseInteger(value, minimum, maximum, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AiRecommendationValidationError(
      `heat_styling_per_week must be a whole number between ${minimum} and ${maximum}.`,
      {
        field: "heat_styling_per_week",
        minimum,
        maximum,
      }
    );
  }

  return parsed;
}

function normaliseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalised = normaliseText(value, 20).toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalised)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalised)) {
    return false;
  }

  throw new AiRecommendationValidationError(
    "scalp_sensitive must be true or false.",
    {
      field: "scalp_sensitive",
    }
  );
}

export function normaliseHaircarePayload(input = {}) {
  const customerId = normaliseText(
    input.customer_id ?? input.customerId,
    100
  );

  const hairType = normaliseEnum(
    input.hair_type ?? input.hairType,
    HAIR_TYPES,
    "hair_type"
  );

  const texture = normaliseEnum(
    input.texture,
    HAIR_TEXTURES,
    "texture",
    "medium"
  );

  const concerns = normaliseEnumArray(
    input.concerns,
    HAIR_CONCERNS,
    "concerns",
    8
  );

  const chemicalServices = normaliseEnumArray(
    input.chemical_services ?? input.chemicalServices,
    CHEMICAL_SERVICES,
    "chemical_services",
    5
  );

  if (
    chemicalServices.includes("none") &&
    chemicalServices.length > 1
  ) {
    throw new AiRecommendationValidationError(
      "chemical_services cannot combine none with another chemical service.",
      {
        field: "chemical_services",
      }
    );
  }

  return {
    ...(customerId ? { customer_id: customerId } : {}),
    hair_type: hairType,
    texture,
    concerns,
    chemical_services: chemicalServices,
    heat_styling_per_week: normaliseInteger(
      input.heat_styling_per_week ?? input.heatStylingPerWeek,
      0,
      14,
      0
    ),
    maintenance_preference: normaliseEnum(
      input.maintenance_preference ?? input.maintenancePreference,
      MAINTENANCE_PREFERENCES,
      "maintenance_preference",
      "medium"
    ),
    scalp_sensitive: normaliseBoolean(
      input.scalp_sensitive ?? input.scalpSensitive,
      false
    ),
    notes: normaliseText(input.notes, 1000),
  };
}

export async function getAiIntegrationStatus({ requestId } = {}) {
  const [healthResult, readinessResult] = await Promise.allSettled([
    getAiServiceHealth({ requestId }),
    getAiServiceReadiness({ requestId }),
  ]);

  const health =
    healthResult.status === "fulfilled"
      ? healthResult.value
      : null;

  const readiness =
    readinessResult.status === "fulfilled"
      ? readinessResult.value
      : null;

  const available = Boolean(
    health?.status === "healthy" &&
      readiness?.status === "ready"
  );

  return {
    available,
    health,
    readiness,
    checkedAt: new Date().toISOString(),
    error:
      available
        ? null
        : readinessResult.reason?.message ||
          healthResult.reason?.message ||
          "The AI service is unavailable.",
  };
}

export async function createHaircareRecommendation(
  input,
  { requestId } = {}
) {
  const payload = normaliseHaircarePayload(input);

  const recommendation = await getHaircareRecommendation(
    payload,
    {
      requestId,
    }
  );

  return {
    ...recommendation,
    request: payload,
    generatedAt: new Date().toISOString(),
  };
}

export default {
  createHaircareRecommendation,
  getAiIntegrationStatus,
  normaliseHaircarePayload,
};
