import mongoose from "mongoose";

import ExternalReputationItem from "./ExternalReputationItem.js";
import ExternalReputationResponse from "./ExternalReputationResponse.js";
import { createServiceError } from "../../shared/serviceError.js";

function text(value, max = 4096) {
  return String(value ?? "").trim().slice(0, max);
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function actorId(value) {
  const candidate = value?._id || value?.id || value;
  return mongoose.isValidObjectId(candidate) ? candidate : null;
}

async function reviewForBusiness(reviewId, businessId) {
  objectId(reviewId, "review");
  const review = await ExternalReputationItem.findOne({ _id: reviewId, business: businessId, status: "active" });
  if (!review) throw createServiceError("External review not found.", 404);
  return review;
}

export async function listExternalReviews(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.provider) match.provider = text(query.provider, 80).toLowerCase();
  if (query.rating) {
    const rating = Number(query.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw createServiceError("rating must be an integer from 1 to 5.", 400);
    }
    match.rating = rating;
  }
  if (query.connection) match.connection = objectId(query.connection, "connection");
  const limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
  const reviews = await ExternalReputationItem.find(match)
    .populate("location", "name")
    .populate("linkedCustomer", "firstName lastName email phone")
    .sort({ providerCreatedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  const responses = reviews.length
    ? await ExternalReputationResponse.find({ business: businessId, review: { $in: reviews.map((item) => item._id) } }).lean()
    : [];
  const byReview = new Map(responses.map((item) => [String(item.review), item]));
  return reviews.map((review) => ({ ...review, response: byReview.get(String(review._id)) || null }));
}

export async function saveExternalReviewResponseDraft(
  reviewId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const review = await reviewForBusiness(reviewId, businessId);
  const userId = actorId(actorUser);
  if (!userId) throw createServiceError("An authenticated staff user is required.", 401);
  const responseText = text(payload.responseText, 4096);
  if (!responseText) throw createServiceError("responseText is required.", 400, { field: "responseText" });

  let response = await ExternalReputationResponse.findOne({ business: businessId, review: review._id });
  if (!response) {
    response = new ExternalReputationResponse({
      business: businessId,
      review: review._id,
      responseText,
      status: "draft",
      createdBy: userId,
      updatedBy: userId,
    });
  } else {
    if (["publishing", "published"].includes(response.status)) {
      throw createServiceError("A publishing or published external review response cannot be edited.", 409);
    }
    response.responseText = responseText;
    response.status = "draft";
    response.approvedBy = null;
    response.approvedAt = null;
    response.failureMessage = "";
    response.updatedBy = userId;
  }
  await response.save();
  return response.toObject();
}

export async function approveExternalReviewResponse(
  reviewId,
  { businessId, actorUser = null } = {}
) {
  const review = await reviewForBusiness(reviewId, businessId);
  const userId = actorId(actorUser);
  if (!userId) throw createServiceError("An authenticated staff user is required.", 401);
  const response = await ExternalReputationResponse.findOne({ business: businessId, review: review._id });
  if (!response) throw createServiceError("External review response draft not found.", 404);
  if (response.status === "published") return response.toObject();
  response.status = "approved";
  response.approvedBy = userId;
  response.approvedAt = new Date();
  response.updatedBy = userId;
  response.failureMessage = "";
  await response.save();
  return response.toObject();
}

export async function rejectExternalReviewResponse(
  reviewId,
  { businessId, actorUser = null } = {}
) {
  const review = await reviewForBusiness(reviewId, businessId);
  const userId = actorId(actorUser);
  if (!userId) throw createServiceError("An authenticated staff user is required.", 401);
  const response = await ExternalReputationResponse.findOne({ business: businessId, review: review._id });
  if (!response) throw createServiceError("External review response draft not found.", 404);
  if (response.status === "published") {
    throw createServiceError("A published external review response cannot be rejected locally.", 409);
  }
  response.status = "rejected";
  response.approvedBy = null;
  response.approvedAt = null;
  response.updatedBy = userId;
  await response.save();
  return response.toObject();
}

export default {
  approveExternalReviewResponse,
  listExternalReviews,
  rejectExternalReviewResponse,
  saveExternalReviewResponseDraft,
};
