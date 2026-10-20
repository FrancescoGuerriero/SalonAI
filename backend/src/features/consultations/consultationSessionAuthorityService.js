import mongoose from "mongoose";

import BusinessMembership from "../../models/BusinessMembership.js";
import Customer from "../../models/customer.js";
import ConsultationSession from "./ConsultationSession.js";

const { ObjectId } = mongoose.Types;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const STATUS_VALUES = new Set([
  "draft",
  "in_progress",
  "awaiting_review",
  "more_information_required",
  "in_person_required",
  "approved",
  "booking_ready",
  "booked",
  "closed",
  "archived",
]);

function authorityError(message, code, statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function text(value) {
  return String(value ?? "").trim();
}

export function consultationObjectId(value, field = "id") {
  if (
    typeof value !== "string" ||
    !OBJECT_ID_PATTERN.test(value.trim())
  ) {
    throw authorityError(
      `${field} must be a valid identifier.`,
      "INVALID_CONSULTATION_IDENTIFIER",
      400
    );
  }

  return new ObjectId(value.trim());
}

function businessId(authority) {
  const value = text(authority?.businessId);
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw authorityError(
      "Trusted Business authority is required.",
      "TRUSTED_BUSINESS_REQUIRED",
      401
    );
  }
  return new ObjectId(value);
}

function locationId(authority) {
  const value = text(authority?.locationId);
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw authorityError(
      "A trusted active Location is required for this action.",
      "LOCATION_CONTEXT_REQUIRED"
    );
  }
  return new ObjectId(value);
}

function allowedLocationIds(authority) {
  if (authority?.locationAccessMode === "all") return null;
  return (Array.isArray(authority?.allowedLocationIds)
    ? authority.allowedLocationIds
    : []
  )
    .filter((value) => OBJECT_ID_PATTERN.test(text(value)))
    .map((value) => new ObjectId(text(value)));
}

function scalar(value, field, maxLength = 120) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw authorityError(
      `${field} must be a single string value.`,
      "INVALID_CONSULTATION_FILTER",
      400
    );
  }
  const valueText = value.trim();
  if (valueText.length > maxLength) {
    throw authorityError(
      `${field} cannot exceed ${maxLength} characters.`,
      "INVALID_CONSULTATION_FILTER",
      400
    );
  }
  return valueText;
}

export function buildConsultationReadScope(authority, query = {}) {
  const filter = { business: businessId(authority) };
  const locations = allowedLocationIds(authority);

  if (locations !== null) {
    filter.location = { $in: locations };
  }

  if (query.locationId) {
    const requested = consultationObjectId(query.locationId, "locationId");
    if (
      locations !== null &&
      !locations.some((value) => value.equals(requested))
    ) {
      filter.location = { $in: [] };
    } else {
      filter.location = requested;
    }
  }

  const status = scalar(query.status, "status", 40);
  if (status) {
    if (!STATUS_VALUES.has(status)) {
      throw authorityError(
        "status is not a supported consultation status.",
        "INVALID_CONSULTATION_FILTER",
        400
      );
    }
    filter.status = status;
  }

  const consultationType = scalar(
    query.consultationType,
    "consultationType",
    120
  );
  if (consultationType) filter.consultationType = consultationType;

  if (query.customerId) {
    filter.customer = consultationObjectId(query.customerId, "customerId");
  }

  if (query.reviewerId) {
    filter["review.reviewer"] = consultationObjectId(
      query.reviewerId,
      "reviewerId"
    );
  }

  return filter;
}

export function buildConsultationMutationScope(authority) {
  return {
    business: businessId(authority),
    location: locationId(authority),
  };
}

export function trustedConsultationOwnership(authority) {
  return Object.freeze(buildConsultationMutationScope(authority));
}

export async function findScopedConsultation(
  sessionId,
  authority,
  { mutation = false } = {}
) {
  const _id = consultationObjectId(sessionId, "consultationId");
  const scope = mutation
    ? buildConsultationMutationScope(authority)
    : buildConsultationReadScope(authority);

  const session = await ConsultationSession.findOne({ _id, ...scope });
  if (!session) {
    throw authorityError(
      "The requested consultation was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }
  return session;
}

export async function assertScopedConsultationCustomer(
  customerId,
  authority
) {
  const _id = consultationObjectId(customerId, "customerId");
  const customer = await Customer.findOne({
    _id,
    business: businessId(authority),
  }).select("_id business");

  if (!customer) {
    throw authorityError(
      "The requested customer was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }
  return customer;
}

export async function assertScopedConsultationReviewer(
  reviewerId,
  authority
) {
  const user = consultationObjectId(reviewerId, "reviewerId");
  const business = businessId(authority);
  const location = locationId(authority);

  const membership = await BusinessMembership.findOne({
    user,
    business,
    status: "active",
  }).select("user business locationAccessMode locations status");

  const canAccessLocation = Boolean(
    membership &&
      (membership.locationAccessMode === "all" ||
        (Array.isArray(membership.locations) &&
          membership.locations.some((value) =>
            new ObjectId(String(value)).equals(location)
          )))
  );

  if (!canAccessLocation) {
    throw authorityError(
      "The requested reviewer was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  return membership;
}

export default {
  assertScopedConsultationCustomer,
  assertScopedConsultationReviewer,
  buildConsultationMutationScope,
  buildConsultationReadScope,
  consultationObjectId,
  findScopedConsultation,
  trustedConsultationOwnership,
};
