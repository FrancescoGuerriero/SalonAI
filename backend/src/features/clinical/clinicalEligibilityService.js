import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import ClinicalCapabilityEligibility, {
  CLINICAL_ELIGIBILITY_STATUSES,
} from "../../models/ClinicalCapabilityEligibility.js";
import Location from "../../models/Location.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated clinical eligibility administrator is required.", 401);
  }
  return value;
}

function date(value, field, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return result;
}

export async function listClinicalEligibility(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.regionKey) match.regionKey = text(query.regionKey).toLowerCase();
  if (query.status) {
    const status = text(query.status).toLowerCase();
    if (!CLINICAL_ELIGIBILITY_STATUSES.includes(status)) {
      throw createServiceError(
        `status must be one of: ${CLINICAL_ELIGIBILITY_STATUSES.join(", ")}.`,
        400,
        { field: "status" }
      );
    }
    match.status = status;
  }
  return ClinicalCapabilityEligibility.find(match)
    .populate("allowedLocations", "name slug hierarchy.regionKey status")
    .populate("approvedBy", "name email")
    .sort({ regionKey: 1 })
    .lean();
}

export async function upsertClinicalEligibility(
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  objectId(businessId, "business");
  const actor = actorId(user);
  const regionKey = text(payload.regionKey).toLowerCase();
  if (!regionKey) {
    throw createServiceError("regionKey is required.", 400, { field: "regionKey" });
  }
  const status = text(payload.status || "suspended").toLowerCase();
  if (!CLINICAL_ELIGIBILITY_STATUSES.includes(status)) {
    throw createServiceError(
      `status must be one of: ${CLINICAL_ELIGIBILITY_STATUSES.join(", ")}.`,
      400,
      { field: "status" }
    );
  }
  const policyVersion = text(payload.policyVersion);
  const jurisdictionReference = text(payload.jurisdictionReference);
  if (!policyVersion || !jurisdictionReference) {
    throw createServiceError(
      "policyVersion and jurisdictionReference are required for Clinical Pack eligibility.",
      400
    );
  }

  const allowedLocations = [
    ...new Set(
      (Array.isArray(payload.allowedLocations) ? payload.allowedLocations : [])
        .map(String)
        .filter(Boolean)
    ),
  ];
  if (allowedLocations.some((value) => !mongoose.isValidObjectId(value))) {
    throw createServiceError("allowedLocations contains an invalid identifier.", 400, {
      field: "allowedLocations",
    });
  }
  if (allowedLocations.length > 0) {
    const owned = await Location.find({
      _id: { $in: allowedLocations },
      business: businessId,
      status: "active",
      "hierarchy.regionKey": regionKey,
    })
      .select("_id")
      .lean();
    if (owned.length !== allowedLocations.length) {
      throw createServiceError(
        "Every allowed clinical Location must be active, tenant-owned and belong to the selected region.",
        409,
        { code: "CLINICAL_ELIGIBILITY_LOCATION_MISMATCH" }
      );
    }
  }

  const validFrom = date(payload.validFrom || new Date(), "validFrom", {
    optional: false,
  });
  const validUntil = date(payload.validUntil, "validUntil");
  if (validUntil && validUntil <= validFrom) {
    throw createServiceError("validUntil must be later than validFrom.", 400, {
      field: "validUntil",
    });
  }

  const before = await ClinicalCapabilityEligibility.findOne({
    business: businessId,
    regionKey,
  }).lean();
  const eligibility = await ClinicalCapabilityEligibility.findOneAndUpdate(
    { business: businessId, regionKey },
    {
      $set: {
        status,
        allowedLocations,
        policyVersion,
        jurisdictionReference,
        approvedBy: actor,
        approvedAt: new Date(),
        validFrom,
        validUntil,
        notes: text(payload.notes),
        metadata:
          payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
            ? payload.metadata
            : {},
      },
      $setOnInsert: {
        business: businessId,
        regionKey,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );

  await AuditLog.create({
    actor,
    action: "clinical.eligibility_configured",
    resourceType: "ClinicalCapabilityEligibility",
    resourceId: String(eligibility._id),
    requestId: text(requestId),
    before: before || null,
    after: {
      businessId: String(businessId),
      regionKey,
      status,
      allowedLocations,
      policyVersion,
      validFrom,
      validUntil,
    },
    metadata: {
      clinicalPackDefault: "disabled",
      explicitEligibilityRequired: true,
    },
  });
  return eligibility.toObject();
}

export default {
  listClinicalEligibility,
  upsertClinicalEligibility,
};
