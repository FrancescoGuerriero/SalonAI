import ConsultationSession from "./ConsultationSession.js";
import {
  evaluateHairColourConsultation,
} from "./hairColourConsultationRules.js";
import {
  requestConsultationInference,
} from "./consultationInferenceService.js";
import {
  assertScopedConsultationCustomer,
  assertScopedConsultationReviewer,
  buildConsultationReadScope,
  findScopedConsultation,
  trustedConsultationOwnership,
} from "./consultationSessionAuthorityService.js";

const ALLOWED_FEATURES = new Set([
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

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(["in_progress", "archived"]),
  in_progress: new Set(["awaiting_review", "archived"]),
  awaiting_review: new Set([
    "more_information_required",
    "in_person_required",
    "approved",
    "closed",
    "archived",
  ]),
  more_information_required: new Set([
    "in_progress",
    "awaiting_review",
    "archived",
  ]),
  in_person_required: new Set([
    "awaiting_review",
    "approved",
    "closed",
    "archived",
  ]),
  approved: new Set(["booking_ready", "closed", "archived"]),
  booking_ready: new Set(["booked", "closed", "archived"]),
  booked: new Set(["closed"]),
  closed: new Set(["archived"]),
  archived: new Set(),
});

const EDITABLE_SESSION_STATUSES = new Set([
  "draft",
  "in_progress",
  "more_information_required",
]);

const REVIEW_DECISIONS = new Set([
  "approved",
  "modified",
  "more_information_required",
  "in_person_required",
  "declined",
]);

function serviceError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function text(value, field, maxLength = 3000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw serviceError(`${field} must be a string.`, "INVALID_CONSULTATION_INPUT");
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw serviceError(
      `${field} cannot exceed ${maxLength} characters.`,
      "INVALID_CONSULTATION_INPUT"
    );
  }
  return result;
}

function booleanValue(value, field) {
  if (typeof value !== "boolean") {
    throw serviceError(`${field} must be a boolean.`, "INVALID_CONSULTATION_INPUT");
  }
  return value;
}

function safeScalar(value, field) {
  if (["string", "number", "boolean"].includes(typeof value) || value === null) {
    if (typeof value === "string" && value.length > 3000) {
      throw serviceError(
        `${field} cannot exceed 3000 characters.`,
        "INVALID_CONSULTATION_INPUT"
      );
    }
    return value;
  }
  throw serviceError(
    `${field} must be a scalar value.`,
    "INVALID_CONSULTATION_INPUT"
  );
}

export function sanitizeConsultationFeatures(features = {}) {
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    throw serviceError(
      "structuredFeatures must be an object.",
      "INVALID_CONSULTATION_INPUT"
    );
  }

  const result = {};
  for (const [key, value] of Object.entries(features)) {
    if (!ALLOWED_FEATURES.has(key)) continue;
    result[key] = safeScalar(value, `structuredFeatures.${key}`);
  }
  return result;
}

export function sanitizeConsultationResponses(responses = []) {
  if (!Array.isArray(responses) || responses.length > 50) {
    throw serviceError(
      "responses must be an array containing no more than 50 answers.",
      "INVALID_CONSULTATION_INPUT"
    );
  }

  return responses.map((response, index) => {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      throw serviceError(
        `responses[${index}] must be an object.`,
        "INVALID_CONSULTATION_INPUT"
      );
    }
    const answeredAt = response.answeredAt ? new Date(response.answeredAt) : new Date();
    if (Number.isNaN(answeredAt.getTime())) {
      throw serviceError(
        `responses[${index}].answeredAt must be a valid date.`,
        "INVALID_CONSULTATION_INPUT"
      );
    }
    return {
      key: text(response.key, `responses[${index}].key`, 120),
      value: safeScalar(response.value ?? null, `responses[${index}].value`),
      source: ["customer", "staff", "whatsapp", "system", "import"].includes(
        response.source
      )
        ? response.source
        : "staff",
      answeredAt,
    };
  });
}

export function assertConsultationTransition(currentStatus, nextStatus) {
  if (!nextStatus || nextStatus === currentStatus) return currentStatus;
  if (!STATUS_TRANSITIONS[currentStatus]?.has(nextStatus)) {
    throw serviceError(
      `Consultation status cannot transition from ${currentStatus} to ${nextStatus}.`,
      "INVALID_CONSULTATION_STATUS_TRANSITION",
      409
    );
  }
  return nextStatus;
}

export function assertConsultationEditable(status) {
  if (!EDITABLE_SESSION_STATUSES.has(status)) {
    throw serviceError(
      "Reviewed, booking-ready, booked, closed or archived consultations cannot be edited through the generic update workflow.",
      "CONSULTATION_REVIEW_REQUIRED_FOR_EDIT",
      409
    );
  }
}

function actorId(request) {
  return request?.user?._id || request?.user?.id || null;
}

function applyAssessment(session) {
  const assessment = evaluateHairColourConsultation(
    session.structuredFeatures || {}
  );
  session.deterministicAssessment = {
    ...assessment,
    evaluatedAt: new Date(),
  };
  return assessment;
}

export async function listConsultationSessions(query, authority) {
  const page = Math.max(1, Math.min(Number.parseInt(query?.page, 10) || 1, 100000));
  const limit = Math.max(1, Math.min(Number.parseInt(query?.limit, 10) || 20, 100));
  const filter = buildConsultationReadScope(authority, query || {});
  const [sessions, total] = await Promise.all([
    ConsultationSession.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean({ virtuals: true }),
    ConsultationSession.countDocuments(filter),
  ]);
  return {
    sessions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getConsultationSession(sessionId, authority) {
  return findScopedConsultation(sessionId, authority);
}

export async function createConsultationSession(payload, request) {
  const authority = request.effectiveAuthority;
  const ownership = trustedConsultationOwnership(authority);
  const customer = await assertScopedConsultationCustomer(payload?.customerId, authority);
  const consultationType = text(
    payload?.consultationType || "hair-colour-chemical",
    "consultationType",
    120
  );
  if (consultationType !== "hair-colour-chemical") {
    throw serviceError(
      "Only the hair-colour-chemical consultation definition is active in this phase.",
      "CONSULTATION_DEFINITION_NOT_ACTIVE",
      409
    );
  }

  const structuredFeatures = sanitizeConsultationFeatures(
    payload?.structuredFeatures || {}
  );
  const responses = sanitizeConsultationResponses(payload?.responses || []);
  const dataProcessingConsent =
    payload?.dataProcessingConsent === undefined
      ? false
      : booleanValue(payload.dataProcessingConsent, "dataProcessingConsent");
  const mediaProcessingConsent =
    payload?.mediaProcessingConsent === undefined
      ? false
      : booleanValue(payload.mediaProcessingConsent, "mediaProcessingConsent");

  const session = new ConsultationSession({
    ...ownership,
    customer: customer._id,
    channel: ["web", "mobile", "whatsapp", "staff"].includes(payload?.channel)
      ? payload.channel
      : "staff",
    consultationType,
    definitionVersion: "1",
    status: responses.length || Object.keys(structuredFeatures).length
      ? "in_progress"
      : "draft",
    responses,
    structuredFeatures,
    governance: {
      dataProcessingConsent,
      mediaProcessingConsent,
      rawTranscriptStored: false,
      createdBy: actorId(request),
      source: text(payload?.source || "staff", "source", 120),
    },
  });
  applyAssessment(session);
  await session.save();
  return session;
}

export async function updateConsultationSession(sessionId, payload, request) {
  const session = await findScopedConsultation(
    sessionId,
    request.effectiveAuthority,
    { mutation: true }
  );

  assertConsultationEditable(session.status);

  if (payload?.customerId || payload?.business || payload?.location) {
    throw serviceError(
      "Consultation ownership and customer identity cannot be changed through this endpoint.",
      "IMMUTABLE_CONSULTATION_OWNERSHIP",
      409
    );
  }

  if (payload?.structuredFeatures !== undefined) {
    session.structuredFeatures = sanitizeConsultationFeatures(
      payload.structuredFeatures
    );
  }
  if (payload?.responses !== undefined) {
    session.responses = sanitizeConsultationResponses(payload.responses);
  }
  if (payload?.status !== undefined) {
    session.status = assertConsultationTransition(
      session.status,
      text(payload.status, "status", 40)
    );
  }
  if (payload?.dataProcessingConsent !== undefined) {
    session.governance.dataProcessingConsent = booleanValue(
      payload.dataProcessingConsent,
      "dataProcessingConsent"
    );
  }
  if (payload?.mediaProcessingConsent !== undefined) {
    session.governance.mediaProcessingConsent = booleanValue(
      payload.mediaProcessingConsent,
      "mediaProcessingConsent"
    );
  }

  applyAssessment(session);
  await session.save();
  return session;
}

export async function assignConsultationReviewer(sessionId, reviewerId, request) {
  const session = await findScopedConsultation(
    sessionId,
    request.effectiveAuthority,
    { mutation: true }
  );
  const membership = await assertScopedConsultationReviewer(
    reviewerId,
    request.effectiveAuthority
  );
  session.review.reviewer = membership.user;
  await session.save();
  return session;
}

function sanitizeCorrections(corrections, reviewerId) {
  if (corrections === undefined) return [];
  if (!Array.isArray(corrections) || corrections.length > 50) {
    throw serviceError(
      "corrections must be an array containing no more than 50 entries.",
      "INVALID_CONSULTATION_INPUT"
    );
  }
  return corrections.map((correction, index) => {
    if (!correction || typeof correction !== "object" || Array.isArray(correction)) {
      throw serviceError(
        `corrections[${index}] must be an object.`,
        "INVALID_CONSULTATION_INPUT"
      );
    }
    return {
      field: text(correction.field, `corrections[${index}].field`, 120),
      previousValue: safeScalar(
        correction.previousValue ?? null,
        `corrections[${index}].previousValue`
      ),
      correctedValue: safeScalar(
        correction.correctedValue ?? null,
        `corrections[${index}].correctedValue`
      ),
      reason: text(correction.reason || "", `corrections[${index}].reason`, 1000),
      correctedBy: reviewerId,
      correctedAt: new Date(),
    };
  });
}

export async function reviewConsultationSession(sessionId, payload, request) {
  const session = await findScopedConsultation(
    sessionId,
    request.effectiveAuthority,
    { mutation: true }
  );
  const decision = text(payload?.decision, "decision", 80);
  if (!REVIEW_DECISIONS.has(decision)) {
    throw serviceError(
      "A supported human-review decision is required.",
      "INVALID_CONSULTATION_REVIEW_DECISION"
    );
  }

  const reviewer = actorId(request);
  session.review.reviewer = reviewer;
  session.review.decision = decision;
  session.review.notes = text(payload?.notes || "", "notes", 3000);
  session.review.reviewedAt = new Date();
  session.review.corrections = sanitizeCorrections(payload?.corrections, reviewer);

  const statusByDecision = {
    approved: "approved",
    modified: "approved",
    more_information_required: "more_information_required",
    in_person_required: "in_person_required",
    declined: "closed",
  };
  const nextStatus = statusByDecision[decision];
  if (nextStatus !== session.status) {
    session.status = assertConsultationTransition(session.status, nextStatus);
  }
  if (decision === "declined") {
    session.closedAt = new Date();
    session.outcome.finalDecision = "declined";
  }

  await session.save();
  return session;
}

export async function approveConsultationForBooking(sessionId, payload, request) {
  const session = await findScopedConsultation(
    sessionId,
    request.effectiveAuthority,
    { mutation: true }
  );
  const assessment = applyAssessment(session);
  if (assessment.bookingBlocked) {
    throw serviceError(
      "Deterministic consultation rules currently block booking readiness.",
      "CONSULTATION_BOOKING_BLOCKED",
      409
    );
  }

  session.review.reviewer = actorId(request);
  session.review.decision = "approved";
  session.review.reviewedAt = new Date();
  session.review.notes = text(payload?.notes || session.review.notes || "", "notes", 3000);

  if (session.status !== "approved") {
    session.status = assertConsultationTransition(session.status, "approved");
  }
  session.status = assertConsultationTransition(session.status, "booking_ready");
  session.outcome.finalDecision = "booking_ready";
  session.completedAt = new Date();
  await session.save();
  return session;
}

export function consultationInferenceEnabled(environment = process.env) {
  return String(environment.CONSULTATION_AI_INFERENCE_ENABLED || "")
    .trim()
    .toLowerCase() === "true";
}

export async function requestSessionAssistance(sessionId, request) {
  if (!consultationInferenceEnabled()) {
    throw serviceError(
      "Consultation AI inference is not enabled for this environment.",
      "CONSULTATION_AI_INFERENCE_DISABLED",
      503
    );
  }

  const session = await findScopedConsultation(
    sessionId,
    request.effectiveAuthority,
    { mutation: true }
  );
  if (session.governance?.dataProcessingConsent !== true) {
    throw serviceError(
      "Recorded data-processing consent is required before AI assistance can run.",
      "CONSULTATION_AI_CONSENT_REQUIRED",
      409
    );
  }

  session.ai.state = "pending";
  session.ai.requestedAt = new Date();
  session.ai.errorCode = "";
  applyAssessment(session);
  await session.save();

  try {
    const result = await requestConsultationInference({
      session,
      features: session.structuredFeatures || {},
      requestId: request.requestId,
    });
    session.deterministicAssessment = {
      ...result.deterministicAssessment,
      evaluatedAt: new Date(),
    };
    Object.assign(session.ai, {
      ...result.ai,
      requestedAt: session.ai.requestedAt,
      completedAt: new Date(),
      errorCode: "",
    });
    if (["draft", "in_progress", "more_information_required"].includes(session.status)) {
      session.status = "awaiting_review";
    }
    await session.save();
    return session;
  } catch (error) {
    session.ai.state = "failed";
    session.ai.completedAt = new Date();
    session.ai.errorCode = error?.code || "CONSULTATION_AI_REQUEST_FAILED";
    await session.save();
    throw error;
  }
}

export default {
  approveConsultationForBooking,
  assignConsultationReviewer,
  assertConsultationEditable,
  assertConsultationTransition,
  consultationInferenceEnabled,
  createConsultationSession,
  getConsultationSession,
  listConsultationSessions,
  requestSessionAssistance,
  reviewConsultationSession,
  sanitizeConsultationFeatures,
  sanitizeConsultationResponses,
  updateConsultationSession,
};
