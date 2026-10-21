import {
  approveConsultationForBooking,
  assignConsultationReviewer,
  createConsultationSession,
  getConsultationSession,
  listConsultationSessions,
  requestSessionAssistance,
  reviewConsultationSession,
  updateConsultationSession,
} from "./consultationSessionService.js";
import {
  convertConsultationToBooking,
} from "./consultationBookingService.js";
import {
  setConsultationRecommendation,
} from "./consultationRecommendationService.js";

const GENERIC_UPDATE_STATUSES = new Set([
  "in_progress",
  "awaiting_review",
  "archived",
]);

export function assertGenericConsultationUpdate(payload = {}) {
  if (payload.status === undefined) return;
  if (
    typeof payload.status !== "string" ||
    !GENERIC_UPDATE_STATUSES.has(payload.status.trim())
  ) {
    const error = new Error(
      "This consultation status can only be changed through its dedicated review or approval workflow."
    );
    error.code = "CONSULTATION_STATUS_REQUIRES_DEDICATED_WORKFLOW";
    error.statusCode = 409;
    throw error;
  }
}

export async function list(request, response) {
  const result = await listConsultationSessions(
    request.query || {},
    request.effectiveAuthority
  );
  return response.status(200).json({
    success: true,
    ...result,
  });
}

export async function getById(request, response) {
  const session = await getConsultationSession(
    request.params.consultationId,
    request.effectiveAuthority
  );
  return response.status(200).json({ success: true, consultation: session });
}

export async function create(request, response) {
  const session = await createConsultationSession(request.body || {}, request);
  return response.status(201).json({
    success: true,
    message: "Consultation session created successfully.",
    consultation: session,
  });
}

export async function update(request, response) {
  assertGenericConsultationUpdate(request.body || {});
  const session = await updateConsultationSession(
    request.params.consultationId,
    request.body || {},
    request
  );
  return response.status(200).json({
    success: true,
    message: "Consultation session updated successfully.",
    consultation: session,
  });
}

export async function assignReviewer(request, response) {
  const session = await assignConsultationReviewer(
    request.params.consultationId,
    request.body?.reviewerId,
    request
  );
  return response.status(200).json({
    success: true,
    message: "Consultation reviewer assigned successfully.",
    consultation: session,
  });
}

export async function recommend(request, response) {
  const session = await setConsultationRecommendation(
    request.params.consultationId,
    request.body || {},
    request
  );
  return response.status(200).json({
    success: true,
    message: "Consultation recommendation saved successfully.",
    consultation: session,
  });
}

export async function review(request, response) {
  const session = await reviewConsultationSession(
    request.params.consultationId,
    request.body || {},
    request
  );
  return response.status(200).json({
    success: true,
    message: "Consultation review recorded successfully.",
    consultation: session,
  });
}

export async function approve(request, response) {
  const session = await approveConsultationForBooking(
    request.params.consultationId,
    request.body || {},
    request
  );
  return response.status(200).json({
    success: true,
    message: "Consultation approved for booking readiness.",
    consultation: session,
  });
}

export async function book(request, response) {
  const result = await convertConsultationToBooking(
    request.params.consultationId,
    request.body || {},
    request
  );
  return response.status(result.duplicate ? 200 : 201).json({
    success: true,
    duplicate: result.duplicate,
    message: result.duplicate
      ? "The consultation appointment already exists."
      : "Appointment created from the approved consultation.",
    consultation: result.consultation,
    appointment: result.appointment,
  });
}

export async function assist(request, response) {
  const session = await requestSessionAssistance(
    request.params.consultationId,
    request
  );
  return response.status(200).json({
    success: true,
    message: "Consultation AI assistance completed and retained for human review.",
    consultation: session,
  });
}

export default {
  approve,
  assignReviewer,
  assist,
  book,
  create,
  getById,
  list,
  recommend,
  review,
  update,
};
