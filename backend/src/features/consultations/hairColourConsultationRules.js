export const HAIR_COLOUR_RULESET_VERSION = "hair-colour-chemical-rules-v1";

const REQUIRED_FIELDS = [
  "desiredOutcome",
  "currentColour",
  "hairCondition",
  "colourHistory",
  "bleachHistory",
  "sensitivities",
];

function text(value) {
  return String(value ?? "").trim();
}

function yesLike(value) {
  if (value === true) return true;
  const normalised = text(value).toLowerCase();
  return ["yes", "true", "required", "known", "present"].includes(normalised);
}

function hasMeaningfulHistory(value) {
  const normalised = text(value).toLowerCase();
  if (!normalised) return false;
  return !["none", "no", "never", "n/a", "na", "not applicable"].includes(normalised);
}

function addFlag(flags, code, severity, label) {
  if (flags.some((flag) => flag.code === code)) return;
  flags.push({ code, severity, label, source: "rule" });
}

export function evaluateHairColourConsultation(features = {}) {
  const missingFields = REQUIRED_FIELDS.filter((key) => !text(features[key]));
  const flags = [];

  if (text(features.sensitivities) && hasMeaningfulHistory(features.sensitivities)) {
    addFlag(
      flags,
      "reported-sensitivity",
      "blocking",
      "Reported sensitivity requires professional review before service eligibility is confirmed."
    );
  }

  if (yesLike(features.patchTestRequired)) {
    addFlag(
      flags,
      "patch-test-required",
      "blocking",
      "A patch test is marked as required before the relevant chemical service can proceed."
    );
  }

  if (hasMeaningfulHistory(features.bleachHistory)) {
    addFlag(
      flags,
      "bleach-history",
      "attention",
      "Previous bleach history should be reviewed by a professional before a colour plan is approved."
    );
  }

  if (hasMeaningfulHistory(features.previousTreatments)) {
    addFlag(
      flags,
      "chemical-treatment-history",
      "attention",
      "Previous chemical treatment history should be considered during professional review."
    );
  }

  if (text(features.hairCondition)) {
    const condition = text(features.hairCondition).toLowerCase();
    const attentionTerms = [
      "damaged",
      "breakage",
      "brittle",
      "fragile",
      "compromised",
      "overprocessed",
      "over-processed",
    ];
    if (attentionTerms.some((term) => condition.includes(term))) {
      addFlag(
        flags,
        "reported-hair-condition",
        "attention",
        "The reported hair condition needs professional assessment before a chemical-service plan is approved."
      );
    }
  }

  const complete = missingFields.length === 0;
  const blocking = flags.some((flag) => flag.severity === "blocking");
  const requiredHumanReview = true;

  return Object.freeze({
    rulesetVersion: HAIR_COLOUR_RULESET_VERSION,
    complete,
    missingFields: Object.freeze([...missingFields]),
    requiredHumanReview,
    bookingBlocked: !complete || blocking,
    flags: Object.freeze(flags.map((flag) => Object.freeze({ ...flag }))),
  });
}

export function buildConsultationInferenceRequest({ session, features } = {}) {
  if (!session?.business || !session?.location) {
    throw new Error("Trusted Business and Location are required for consultation inference.");
  }

  const assessment = evaluateHairColourConsultation(features || session.structuredFeatures || {});

  return Object.freeze({
    capability: "consultation_assistance",
    consultationType: session.consultationType || "hair-colour-chemical",
    definitionVersion: session.definitionVersion || "1",
    tenantContext: Object.freeze({
      businessId: String(session.business),
      locationId: String(session.location),
    }),
    features: Object.freeze({ ...(features || session.structuredFeatures || {}) }),
    deterministicAssessment: assessment,
    constraints: Object.freeze({
      humanReviewRequired: true,
      deterministicBookingBlock: assessment.bookingBlocked,
      canonicalWritesAllowed: false,
      medicalDiagnosisAllowed: false,
      safetyRuleOverrideAllowed: false,
    }),
  });
}
