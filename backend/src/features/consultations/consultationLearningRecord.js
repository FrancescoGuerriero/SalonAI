import { createHash } from "node:crypto";

function clean(value) {
  return String(value ?? "").trim();
}

function pseudonymise(value, namespace) {
  const source = clean(value);
  if (!source) return "";
  return createHash("sha256")
    .update(`${namespace}:${source}`)
    .digest("hex");
}

function structuredFeatureSubset(features = {}) {
  const allowed = [
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
  ];

  return Object.freeze(
    Object.fromEntries(
      allowed
        .filter((key) => features[key] !== undefined && features[key] !== null)
        .map((key) => [key, features[key]])
    )
  );
}

export function evaluateConsultationLearningEligibility(session = {}) {
  const reasons = [];

  if (!session.business || !session.location) reasons.push("missing-tenant-scope");
  if (session.governance?.dataProcessingConsent !== true) reasons.push("operational-consent-not-recorded");
  if (!session.deterministicAssessment?.rulesetVersion) reasons.push("missing-ruleset-provenance");
  if (!["approved", "booking_ready", "booked", "closed"].includes(session.status)) {
    reasons.push("consultation-not-finalised");
  }
  if (!session.review?.decision) reasons.push("missing-human-review-label");
  if (!session.outcome?.observedAt) reasons.push("outcome-not-observed");

  return Object.freeze({
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export function buildConsultationLearningRecord(session = {}) {
  const eligibility = evaluateConsultationLearningEligibility(session);
  if (!eligibility.eligible) {
    return Object.freeze({
      eligible: false,
      reasons: eligibility.reasons,
      record: null,
    });
  }

  const record = Object.freeze({
    schemaVersion: "consultation-learning-v1",
    tenantKey: pseudonymise(session.business, "business"),
    locationKey: pseudonymise(session.location, "location"),
    consultationKey: pseudonymise(session._id, "consultation"),
    consultationType: session.consultationType || "hair-colour-chemical",
    definitionVersion: session.definitionVersion || "1",
    features: structuredFeatureSubset(session.structuredFeatures || {}),
    ruleEvidence: Object.freeze({
      rulesetVersion: session.deterministicAssessment?.rulesetVersion || "",
      flagCodes: Object.freeze(
        (session.deterministicAssessment?.flags || []).map((flag) => flag.code).filter(Boolean)
      ),
      bookingBlocked: Boolean(session.deterministicAssessment?.bookingBlocked),
    }),
    aiEvidence: Object.freeze({
      modelName: session.ai?.modelName || "",
      modelVersion: session.ai?.modelVersion || "",
      promptVersion: session.ai?.promptVersion || "",
      featureVersion: session.ai?.featureVersion || "",
      datasetVersion: session.ai?.datasetVersion || "",
      confidence: session.ai?.confidence ?? null,
    }),
    labels: Object.freeze({
      reviewDecision: session.review?.decision || "",
      correctionFields: Object.freeze(
        (session.review?.corrections || []).map((item) => item.field).filter(Boolean)
      ),
      finalDecision: session.outcome?.finalDecision || "",
      bookingConverted: Boolean(session.outcome?.bookingConverted),
      servicePerformed: session.outcome?.servicePerformed ?? null,
      customerAcceptedRecommendation:
        session.outcome?.customerAcceptedRecommendation ?? null,
    }),
    observedAt: session.outcome?.observedAt || null,
    privacy: Object.freeze({
      customerIdentifierIncluded: false,
      appointmentIdentifierIncluded: false,
      conversationIdentifierIncluded: false,
      rawTranscriptIncluded: false,
      freeTextNotesIncluded: false,
    }),
  });

  return Object.freeze({
    eligible: true,
    reasons: Object.freeze([]),
    record,
  });
}
