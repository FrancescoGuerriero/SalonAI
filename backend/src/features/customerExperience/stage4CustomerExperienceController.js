import * as service from "./stage4CustomerExperienceService.js";

export async function checkIn(request, response) {
  return response.json({
    success: true,
    appointment: await service.checkInCustomerAppointment(request.body?.appointmentId, request),
  });
}

export async function recoveryMetrics(request, response) {
  return response.json({
    success: true,
    metrics: await service.bookingRecoveryMetrics(request),
  });
}

export async function reputation(request, response) {
  return response.json({
    success: true,
    ...(await service.reputationOverview(request)),
  });
}

export async function updateReputation(request, response) {
  return response.json({
    success: true,
    ...(await service.updateReputationReview(request.params.reviewId, request.body || {}, request)),
  });
}

export default { checkIn, recoveryMetrics, reputation, updateReputation };
