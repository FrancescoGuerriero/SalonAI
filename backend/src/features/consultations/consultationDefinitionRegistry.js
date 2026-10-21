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

const DEFINITIONS = Object.freeze({
  "hair-colour-chemical": Object.freeze({
    id: "hair-colour-chemical",
    version: "1",
    vertical: "salon",
    active: true,
    featureKeys: HAIR_COLOUR_FEATURES,
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
  requireConsultationDefinition,
};
