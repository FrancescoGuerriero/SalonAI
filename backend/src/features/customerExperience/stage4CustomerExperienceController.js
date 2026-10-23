import * as service from "./stage4CustomerExperienceService.js";
import { linkExternalReviewCustomer } from "../reputation/externalReviewLinkageService.js";
import { createServiceError } from "../../shared/serviceError.js";

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!value) {
    throw createServiceError(
      "A trusted active business is required for reputation operations.",
      400
    );
  }
  return value;
}

function actorUser(request) {
  return request.user?._id || request.user?.id || null;
}

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

export async function linkExternalReputation(request, response) {
  return response.json({
    success: true,
    review: await linkExternalReviewCustomer(
      request.params.reviewId,
      request.body || {},
      {
        businessId: businessId(request),
        actorUser: actorUser(request),
      }
    ),
  });
}

export default {
  checkIn,
  importExternalReviews,
  importListingSnapshots,
  linkExternalReputation,
  recoveryMetrics,
  reputation,
  updateExternalReputation,
  updateReputation,
};
