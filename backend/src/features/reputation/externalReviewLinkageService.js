import mongoose from "mongoose";

import Customer from "../../models/customer.js";
import ExternalReview from "./ExternalReview.js";
import { createServiceError } from "../../shared/serviceError.js";

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const candidate = value?._id || value?.id || value;
  if (!mongoose.isValidObjectId(candidate)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return candidate;
}

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function linkExternalReviewCustomer(
  reviewId,
  payload = {},
  {
    businessId,
    actorUser = null,
  } = {}
) {
  objectId(businessId, "business");
  objectId(reviewId, "externalReview");
  const review = await ExternalReview.findOne({
    _id: reviewId,
    business: businessId,
  });
  if (!review) {
    throw createServiceError("External review not found in the active business.", 404);
  }

  const status = String(payload.status || "verified").trim().toLowerCase();
  if (!["unlinked", "candidate", "verified", "rejected"].includes(status)) {
    throw createServiceError("External review linkage status is invalid.", 400, {
      field: "status",
    });
  }

  if (["unlinked", "rejected"].includes(status)) {
    review.customer = null;
    review.linkage = {
      status,
      method: status === "unlinked" ? "none" : "manual",
      linkedAt: null,
      linkedBy: objectId(actorUser, "actorUser", { optional: true }),
      note: text(payload.note),
    };
    await review.save();
    return review.toObject();
  }

  const customerId = objectId(payload.customer, "customer");
  const customer = await Customer.findOne({
    _id: customerId,
    business: businessId,
    status: { $ne: "deleted" },
  })
    .select("_id")
    .lean();
  if (!customer) {
    throw createServiceError(
      "External review customer not found in the active business.",
      404
    );
  }

  review.customer = customer._id;
  review.linkage = {
    status,
    method: "manual",
    linkedAt: status === "verified" ? new Date() : null,
    linkedBy: objectId(actorUser, "actorUser", { optional: true }),
    note: text(payload.note),
  };
  await review.save();
  return review.toObject();
}

export default {
  linkExternalReviewCustomer,
};
