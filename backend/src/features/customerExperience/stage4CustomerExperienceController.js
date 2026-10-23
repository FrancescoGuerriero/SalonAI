import * as service from "./stage4CustomerExperienceService.js";

export async function checkIn(request, response) {
  return response.json({
    success: true,
    appointment: await service.checkInCustomerAppointment(
      request.body?.appointmentId,
      request
    ),
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
    ...(await service.updateReputationReview(
      request.params.reviewId,
      request.body || {},
      request
    )),
  });
}

export async function importExternalReviews(request, response) {
  return response.status(201).json({
    success: true,
    ...(await service.importExternalReviews(request.body || {}, request)),
  });
}

export async function importListingSnapshots(request, response) {
  return response.status(201).json({
    success: true,
    ...(await service.importListingSnapshots(request.body || {}, request)),
  });
}

export async function updateExternalReputation(request, response) {
  return response.json({
    success: true,
    response: await service.updateExternalReviewResponse(
      request.params.reviewId,
      request.body || {},
      request
    ),
  });
}

export default {
  checkIn,
  importExternalReviews,
  importListingSnapshots,
  recoveryMetrics,
  reputation,
  updateExternalReputation,
  updateReputation,
};
