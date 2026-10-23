import { createServiceError } from "../../shared/serviceError.js";
import { growthChannelCatalogue } from "./growthChannelCatalogue.js";
import {
  approveExternalReviewResponse,
  listExternalReviews,
  rejectExternalReviewResponse,
  saveExternalReviewResponseDraft,
} from "./externalReputationService.js";
import {
  publishApprovedGoogleReviewReply,
  syncGoogleBusinessProfileReviews,
} from "./googleBusinessProfileService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) throw createServiceError("A trusted active business is required for growth channel operations.", 400);
  return value;
}

function locationId(request) {
  return request.effectiveAuthority?.locationId || request.tenantContext?.locationId || null;
}

function actorUser(request) {
  return request.user?._id || request.user?.id || null;
}

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function catalogue(_request, response) {
  response.json(growthChannelCatalogue());
}

export async function reviews(request, response) {
  response.json({ items: await listExternalReviews(request.query || {}, { businessId: businessId(request) }) });
}

export async function syncGoogleReviews(request, response) {
  response.status(201).json(await syncGoogleBusinessProfileReviews(
    request.params.connectionId,
    body(request),
    { businessId: businessId(request), locationId: locationId(request) }
  ));
}

export async function saveReviewResponse(request, response) {
  response.json(await saveExternalReviewResponseDraft(
    request.params.reviewId,
    body(request),
    { businessId: businessId(request), actorUser: actorUser(request) }
  ));
}

export async function approveReviewResponse(request, response) {
  response.json(await approveExternalReviewResponse(
    request.params.reviewId,
    { businessId: businessId(request), actorUser: actorUser(request) }
  ));
}

export async function rejectReviewResponse(request, response) {
  response.json(await rejectExternalReviewResponse(
    request.params.reviewId,
    { businessId: businessId(request), actorUser: actorUser(request) }
  ));
}

export async function publishReviewResponse(request, response) {
  response.status(201).json(await publishApprovedGoogleReviewReply(
    request.params.reviewId,
    { businessId: businessId(request), actorUser: actorUser(request) }
  ));
}

export default {
  approveReviewResponse,
  catalogue,
  publishReviewResponse,
  rejectReviewResponse,
  reviews,
  saveReviewResponse,
  syncGoogleReviews,
};
