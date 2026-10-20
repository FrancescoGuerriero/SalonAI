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
  create,
  getById,
  list,
  review,
  update,
};
