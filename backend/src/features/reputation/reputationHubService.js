import { createHash } from "node:crypto";
import mongoose from "mongoose";

import IntegrationConnection from "../../models/IntegrationConnection.js";
import Location from "../../models/Location.js";
import ExternalReview from "./ExternalReview.js";
import ExternalReputationResponse from "./ExternalReputationResponse.js";
import BusinessListingSnapshot from "./BusinessListingSnapshot.js";
import { createServiceError } from "../../shared/serviceError.js";

function text(value, max = 10000) {
  return String(value ?? "").trim().slice(0, max);
}

function lower(value, max = 200) {
  return text(value, max).toLowerCase();
}

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const candidate = value?._id || value?.id || value;
  if (!mongoose.isValidObjectId(candidate)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return candidate;
}

function date(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function digest(value) {
  const encoded = JSON.stringify(value ?? {});
  return createHash("sha256").update(encoded).digest("hex");
}

function externalReferenceHash(value) {
  const normalised = lower(value, 2000);
  return normalised
    ? createHash("sha256").update(normalised).digest("hex")
    : "";
}

async function provenance(
  {
    businessId,
    connectionId = null,
    locationId = null,
    provider = "",
  } = {}
) {
  objectId(businessId, "business");
  const connectionObjectId = objectId(connectionId, "connection", { optional: true });
  const locationObjectId = objectId(locationId, "location", { optional: true });

  const [connection, location] = await Promise.all([
    connectionObjectId
      ? IntegrationConnection.findOne({
          _id: connectionObjectId,
          business: businessId,
          status: { $ne: "revoked" },
        }).lean()
      : null,
    locationObjectId
      ? Location.findOne({
          _id: locationObjectId,
          business: businessId,
          status: { $ne: "archived" },
        }).lean()
      : null,
  ]);

  if (connectionObjectId && !connection) {
    throw createServiceError(
      "Reputation provider connection not found in the active business.",
      404
    );
  }
  if (locationObjectId && !location) {
    throw createServiceError(
      "Reputation location not found in the active business.",
      404
    );
  }

  const resolvedProvider = lower(provider || connection?.provider, 120);
  if (!resolvedProvider) {
    throw createServiceError("A reputation provider is required.", 400, {
      field: "provider",
    });
  }

  return {
    businessId,
    connection,
    connectionId: connectionObjectId,
    location,
    locationId: locationObjectId,
    provider: resolvedProvider,
  };
}

function rating(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1 || number > 5) {
    throw createServiceError("External review rating must be between 1 and 5.", 400, {
      field: "rating",
    });
  }
  return number;
}

export async function ingestExternalReviews(
  payload = {},
  {
    businessId,
  } = {}
) {
  const records = Array.isArray(payload.records)
    ? payload.records
    : Array.isArray(payload.reviews)
      ? payload.reviews
      : [];
  if (!records.length) {
    throw createServiceError("At least one external review is required.", 400);
  }
  if (records.length > 5000) {
    throw createServiceError("External review imports are limited to 5,000 records.", 400);
  }

  const source = await provenance({
    businessId,
    connectionId: payload.connection,
    locationId: payload.location,
    provider: payload.provider,
  });
  const now = new Date();
  const results = [];

  for (const record of records) {
    const externalReviewId = text(
      record.externalReviewId || record.reviewId || record.id,
      1000
    );
    if (!externalReviewId) {
      throw createServiceError("Every external review requires an externalReviewId.", 400);
    }
    const reviewedAt = date(
      record.reviewedAt || record.createdAt || record.timestamp,
      "reviewedAt"
    );
    const reviewerReference =
      record.reviewer?.externalReference ||
      record.reviewerId ||
      record.authorId ||
      "";
    const providerPayloadDigest = digest(record.providerPayload ?? record.raw ?? record);

    const review = await ExternalReview.findOneAndUpdate(
      {
        business: businessId,
        provider: source.provider,
        externalReviewId,
      },
      {
        $set: {
          connection: source.connectionId,
          location: source.locationId,
          externalLocationReference: text(
            record.externalLocationReference || record.locationReference,
            1000
          ),
          reviewer: {
            displayName: text(
              record.reviewer?.displayName || record.reviewerName || record.authorName,
              300
            ),
            externalReferenceHash: externalReferenceHash(reviewerReference),
          },
          rating: rating(record.rating),
          title: text(record.title, 500),
          body: text(record.body || record.comment || record.text, 10000),
          reviewedAt,
          sourceUrl: text(record.sourceUrl || record.url, 3000),
          status: lower(record.status || "active", 30) === "removed"
            ? "removed"
            : "active",
          providerPayloadDigest,
          lastSeenAt: now,
          metadata:
            record.metadata && typeof record.metadata === "object"
              ? record.metadata
              : {},
        },
        $setOnInsert: {
          business: businessId,
          provider: source.provider,
          externalReviewId,
          importedAt: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();
    results.push(review);
  }

  return {
    provider: source.provider,
    imported: results.length,
    reviews: results,
  };
}

export async function ingestListingSnapshots(
  payload = {},
  {
    businessId,
  } = {}
) {
  const records = Array.isArray(payload.records)
    ? payload.records
    : Array.isArray(payload.listings)
      ? payload.listings
      : [];
  if (!records.length) {
    throw createServiceError("At least one listing snapshot is required.", 400);
  }
  if (records.length > 1000) {
    throw createServiceError("Listing snapshot imports are limited to 1,000 records.", 400);
  }

  const source = await provenance({
    businessId,
    connectionId: payload.connection,
    locationId: payload.location,
    provider: payload.provider,
  });

  const documents = records.map((record) => {
    const externalLocationReference = text(
      record.externalLocationReference || record.locationReference || record.id,
      1000
    );
    if (!externalLocationReference) {
      throw createServiceError(
        "Every listing snapshot requires an externalLocationReference.",
        400
      );
    }
    return {
      business: businessId,
      connection: source.connectionId,
      location: source.locationId,
      provider: source.provider,
      externalLocationReference,
      observedAt: date(record.observedAt || record.updatedAt, "observedAt"),
      listing: {
        name: text(record.name || record.listing?.name, 500),
        address: text(record.address || record.listing?.address, 1500),
        phone: text(record.phone || record.listing?.phone, 100),
        websiteUrl: text(record.websiteUrl || record.listing?.websiteUrl, 3000),
        primaryCategory: text(
          record.primaryCategory || record.listing?.primaryCategory,
          300
        ),
        status: lower(record.status || record.listing?.status, 100),
      },
      providerPayloadDigest: digest(record.providerPayload ?? record.raw ?? record),
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? record.metadata
          : {},
    };
  });

  const snapshots = await BusinessListingSnapshot.insertMany(documents, {
    ordered: false,
  });
  return {
    provider: source.provider,
    imported: snapshots.length,
    snapshots: snapshots.map((entry) => entry.toObject()),
  };
}

export async function updateExternalReputationResponse(
  externalReviewId,
  payload = {},
  {
    businessId,
    actorUser = null,
  } = {}
) {
  objectId(externalReviewId, "externalReview");
  const review = await ExternalReview.findOne({
    _id: externalReviewId,
    business: businessId,
  }).lean();
  if (!review) {
    throw createServiceError("External review not found in the active business.", 404);
  }

  const responseText = text(payload.responseText, 4000);
  const requestedStatus = lower(
    payload.responseStatus || (responseText ? "draft" : "none"),
    30
  );
  if (!["none", "draft", "approved", "withdrawn"].includes(requestedStatus)) {
    if (requestedStatus === "published") {
      throw createServiceError(
        "External review publication is provider-gated and cannot be marked published manually.",
        409,
        { code: "EXTERNAL_REVIEW_RESPONSE_PUBLICATION_GATED" }
      );
    }
    throw createServiceError("External review response status is invalid.", 400);
  }
  if (["draft", "approved"].includes(requestedStatus) && !responseText) {
    throw createServiceError("A drafted or approved response requires response text.", 400);
  }

  return ExternalReputationResponse.findOneAndUpdate(
    {
      business: businessId,
      externalReview: review._id,
    },
    {
      $set: {
        responseText,
        responseStatus: requestedStatus,
        moderationNote: text(payload.moderationNote, 1000),
        moderatedAt: new Date(),
        moderatedBy: objectId(actorUser, "actorUser", { optional: true }),
      },
      $setOnInsert: {
        business: businessId,
        externalReview: review._id,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

export async function externalReputationOverview(
  query = {},
  {
    businessId,
  } = {}
) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.provider) match.provider = lower(query.provider, 120);
  if (query.location) match.location = objectId(query.location, "location");
  if (query.status) match.status = lower(query.status, 30);

  const reviews = await ExternalReview.find(match)
    .sort({ reviewedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(1000, Number(query.limit) || 250)))
    .lean();
  const responses = reviews.length
    ? await ExternalReputationResponse.find({
        business: businessId,
        externalReview: { $in: reviews.map((review) => review._id) },
      }).lean()
    : [];
  const responsesByReview = new Map(
    responses.map((response) => [String(response.externalReview), response])
  );

  const active = reviews.filter((review) => review.status === "active");
  const averageRating = active.length
    ? Number(
        (
          active.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
          active.length
        ).toFixed(2)
      )
    : 0;
  const ratingDistribution = Object.fromEntries(
    [1, 2, 3, 4, 5].map((value) => [
      value,
      active.filter((review) => review.rating === value).length,
    ])
  );
  const providerCounts = {};
  for (const review of active) {
    providerCounts[review.provider] = (providerCounts[review.provider] || 0) + 1;
  }

  const listingMatch = { business: businessId };
  if (query.provider) listingMatch.provider = lower(query.provider, 120);
  if (query.location) listingMatch.location = objectId(query.location, "location");
  const latestListings = await BusinessListingSnapshot.aggregate([
    { $match: listingMatch },
    { $sort: { observedAt: -1, _id: -1 } },
    {
      $group: {
        _id: {
          provider: "$provider",
          externalLocationReference: "$externalLocationReference",
        },
        snapshot: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$snapshot" } },
    { $sort: { provider: 1, observedAt: -1 } },
  ]);

  return {
    reviews: reviews.map((review) => ({
      ...review,
      response: responsesByReview.get(String(review._id)) || null,
    })),
    listings: latestListings,
    summary: {
      total: reviews.length,
      active: active.length,
      averageRating,
      ratingDistribution,
      providerCounts,
      responseStatusCounts: Object.fromEntries(
        ["none", "draft", "approved", "published", "withdrawn"].map((status) => [
          status,
          status === "none"
            ? reviews.filter((review) => !responsesByReview.get(String(review._id))).length
            : responses.filter((response) => response.responseStatus === status).length,
        ])
      ),
    },
  };
}

export default {
  externalReputationOverview,
  ingestExternalReviews,
  ingestListingSnapshots,
  updateExternalReputationResponse,
};
