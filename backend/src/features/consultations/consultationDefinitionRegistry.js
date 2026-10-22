import {
  buildConsultationInferenceRequest as buildHairColourInferenceRequest,
  evaluateHairColourConsultation,
} from "./hairColourConsultationRules.js";

const HAIR_COLOUR_FEATURES = Object.freeze([
  "hairType",
  "texturePattern",
  "density",
  "strandThickness",
  "length",
  "porosity",
  "hairCondition",
  "naturalColour",
  "currentColour",
  "greyPercentage",
  "colourHistory",
  "bleachHistory",
  "previousTreatments",
  "maintenancePreference",
  "budgetRange",
  "sensitivities",
  "patchTestRequired",
  "desiredOutcome",
]);

const HAIR_COLOUR_QUESTIONS = Object.freeze([
  Object.freeze({
    field: "desiredOutcome",
    prompt: "What result would you like to achieve with your hair colour?",
  }),
  Object.freeze({
    field: "currentColour",
    prompt: "What is your current hair colour?",
  }),
  Object.freeze({
    field: "naturalColour",
    prompt:
      "What is your natural hair colour or natural base, if you know it? Reply UNKNOWN if you are not sure.",
  }),
  Object.freeze({
    field: "colourHistory",
    prompt:
      "Has your hair been coloured before? Please briefly describe the colour history, or reply NONE.",
  }),
  Object.freeze({
    field: "bleachHistory",
    prompt:
      "Has your hair been bleached or lightened before? Please briefly describe it, or reply NONE.",
  }),
  Object.freeze({
    field: "hairCondition",
    prompt:
      "How would you describe the current condition of your hair, for example healthy, dry, damaged or fragile?",
  }),
  Object.freeze({
    field: "length",
    prompt:
      "Approximately how long is your hair, for example very short, short, medium, long or very long?",
  }),
  Object.freeze({
    field: "density",
    prompt:
      "How would you describe your hair density, for example fine, medium or thick?",
  }),
  Object.freeze({
    field: "sensitivities",
    prompt:
      "Do you have any known scalp or skin sensitivities relevant to hair colouring? Reply NONE if not.",
  }),
]);

const DEFINITIONS = Object.freeze({
  "hair-colour-chemical": Object.freeze({
    id: "hair-colour-chemical",
    version: "1",
    vertical: "salon",
    active: true,
    featureKeys: HAIR_COLOUR_FEATURES,
    questions: HAIR_COLOUR_QUESTIONS,
    humanReviewRequired: true,
    media: Object.freeze({
      enabled: true,
      consentRequired: true,
      maxItems: 3,
      acceptedContentTypes: Object.freeze([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]),
    }),
    evaluate: evaluateHairColourConsultation,
    buildInferenceRequest: buildHairColourInferenceRequest,
  }),
});

export function listConsultationDefinitions({ activeOnly = true } = {}) {
  return Object.freeze(
    Object.values(DEFINITIONS).filter(
      (definition) => !activeOnly || definition.active === true
    )
  );
}

export function getConsultationDefinition(consultationType, definitionVersion = "") {
  const type = String(consultationType || "").trim();
  const definition = DEFINITIONS[type] || null;
  if (!definition || definition.active !== true) return null;
  if (
    definitionVersion &&
    String(definitionVersion).trim() !== definition.version
  ) {
    return null;
  }
  return definition;
}

export function requireConsultationDefinition(
  consultationType,
  definitionVersion = ""
) {
  const definition = getConsultationDefinition(
    consultationType,
    definitionVersion
  );
  if (!definition) {
    const error = new Error(
      "The requested consultation definition is not active or its version is unsupported."
    );
    error.code = "CONSULTATION_DEFINITION_NOT_ACTIVE";
    error.status = 409;
    error.statusCode = 409;
    throw error;
  }
  return definition;
}

export function allowedConsultationFeatureKeys(
  consultationType,
  definitionVersion = ""
) {
  return new Set(
    requireConsultationDefinition(
      consultationType,
      definitionVersion
    ).featureKeys
  );
}

export function nextConsultationDefinitionQuestion({
  consultationType,
  definitionVersion = "",
  features = {},
} = {}) {
  const definition = requireConsultationDefinition(
    consultationType,
    definitionVersion
  );
  const question = (definition.questions || []).find(
    ({ field }) => !String(features?.[field] ?? "").trim()
  );
  if (!question) return null;
  return Object.freeze({
    field: question.field,
    question: question.prompt,
  });
}

export function evaluateConsultationDefinition({
  consultationType,
  definitionVersion = "",
  features = {},
} = {}) {
  const definition = requireConsultationDefinition(
    consultationType,
    definitionVersion
  );
  return definition.evaluate(features);
}

export function buildDefinitionInferenceRequest({ session, features } = {}) {
  const definition = requireConsultationDefinition(
    session?.consultationType,
    session?.definitionVersion
  );
  return definition.buildInferenceRequest({ session, features });
}

export default {
  allowedConsultationFeatureKeys,
  buildDefinitionInferenceRequest,
  evaluateConsultationDefinition,
  getConsultationDefinition,
  listConsultationDefinitions,
  nextConsultationDefinitionQuestion,
  requireConsultationDefinition,
};
