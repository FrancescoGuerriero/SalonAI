import { createHash } from "node:crypto";
import mongoose from "mongoose";

import IntegrationConnection from "../../models/IntegrationConnection.js";
import ExternalReputationItem from "./ExternalReputationItem.js";
import ExternalReputationResponse from "./ExternalReputationResponse.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

const GBP_REVIEW_BASE = "https://mybusiness.googleapis.com/v4";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REVIEW_PAGES = 20;

function text(value, max = 2000) {
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

function rating(value) {
  const values = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return values[String(value || "").toUpperCase()] || null;
}

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rawHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function requestJson(url, options = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const raw = await response.text();
      let body = {};
      if (raw) {
        try { body = JSON.parse(raw); }
        catch { body = { raw: text(raw, 2000) }; }
      }
      if (response.ok) return { response, body };
      const retryable = response.status === 429 || response.status >= 500;
      lastError = createServiceError(`Google Business Profile request failed with HTTP ${response.status}.`, response.status, {
        code: "GOOGLE_BUSINESS_PROFILE_HTTP_ERROR",
        providerStatus: response.status,
        providerBody: body,
      });
      if (!retryable || attempt >= retries) throw lastError;
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter)
        ? Math.min(30000, Math.max(1000, retryAfter * 1000))
        : Math.min(10000, 1000 * (2 ** attempt));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = createServiceError("Google Business Profile request timed out.", 504, {
          code: "GOOGLE_BUSINESS_PROFILE_TIMEOUT",
        });
      } else {
        lastError = error;
      }
      if (attempt >= retries || (lastError?.statusCode && lastError.statusCode < 500 && lastError.statusCode !== 429)) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(10000, 1000 * (2 ** attempt))));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || createServiceError("Google Business Profile request failed.", 502);
}

async function connectionForBusiness(connectionId, businessId) {
  objectId(connectionId, "connection");
  objectId(businessId, "business");
  const connection = await IntegrationConnection.findOne({
    _id: connectionId,
    business: businessId,
    provider: "google_business_profile",
    status: { $in: ["connected", "degraded"] },
  });
  if (!connection) {
    throw createServiceError("Connected Google Business Profile integration not found.", 404);
  }
  return connection;
}

async function refreshGoogleToken(connection) {
  const clientId = text(connection.metadata?.oauthClientId, 500);
  if (!clientId) throw createServiceError("Google OAuth client ID is missing from connection metadata.", 409);
  const [refresh, clientSecret] = await Promise.all([
    resolveProviderCredential(connection, "refresh_token"),
    resolveProviderCredential(connection, "client_secret"),
  ]);
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret.secret,
    refresh_token: refresh.secret,
    grant_type: "refresh_token",
  });
  const { body } = await requestJson(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, 1);
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) throw createServiceError("Google OAuth refresh returned no access token.", 502);
  const expiresIn = Math.max(60, Math.min(86400, Number(body.expires_in) || 3600));
  await storeProviderCredential(
    connection.app,
    connection._id,
    {
      role: "access_token",
      secret: accessToken,
      expiresAt: new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000),
      metadata: { refreshedBy: "google_business_profile" },
    },
    { businessId: connection.business }
  );
  return accessToken;
}

async function bearer(connection) {
  try {
    return (await resolveProviderCredential(connection, "access_token")).secret;
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE"].includes(error?.code)) throw error;
    return refreshGoogleToken(connection);
  }
}

function locationName(connection) {
  const supplied = text(connection.metadata?.locationName, 500);
  if (/^accounts\/[^/]+\/locations\/[^/]+$/.test(supplied)) return supplied;
  const accountId = text(connection.metadata?.accountId, 200);
  const locationId = text(connection.metadata?.locationId, 200);
  if (!accountId || !locationId) {
    throw createServiceError("Google Business Profile connection requires metadata.locationName or accountId/locationId.", 409);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(accountId) || !/^[A-Za-z0-9_-]+$/.test(locationId)) {
    throw createServiceError("Google Business Profile resource identifiers are invalid.", 400);
  }
  return `accounts/${accountId}/locations/${locationId}`;
}

function mapReview(review, connection, businessId, locationId = null) {
  const externalId = text(review.reviewId || review.review_id || review.name?.split("/").pop(), 500);
  if (!externalId) throw createServiceError("Google review is missing its external review ID.", 502);
  const reply = review.reviewReply || review.review_reply || {};
  return {
    business: businessId,
    location: locationId || null,
    app: connection.app,
    connection: connection._id,
    provider: "google_business_profile",
    externalId,
    listingExternalId: locationName(connection),
    reviewer: {
      displayName: text(review.reviewer?.displayName || review.reviewer?.display_name, 300),
      profilePhotoUrl: text(review.reviewer?.profilePhotoUrl || review.reviewer?.profile_photo_url, 2000),
      anonymous: Boolean(review.reviewer?.isAnonymous ?? review.reviewer?.is_anonymous),
    },
    rating: rating(review.starRating || review.star_rating),
    comment: text(review.comment, 20000),
    sourceUrl: text(review.name, 2000),
    reviewReplyUrl: text(review.reviewReplyUrl || review.review_reply_url, 2000),
    providerCreatedAt: safeDate(review.createTime || review.create_time),
    providerUpdatedAt: safeDate(review.updateTime || review.update_time),
    providerReply: {
      comment: text(reply.comment, 4096),
      state: text(reply.reviewReplyState || reply.review_reply_state, 80).toLowerCase(),
      updatedAt: safeDate(reply.updateTime || reply.update_time),
    },
    status: "active",
    provenance: {
      providerSchemaVersion: "google.mybusiness.v4",
      rawHash: rawHash(review),
      syncedAt: new Date(),
    },
  };
}

export async function syncGoogleBusinessProfileReviews(
  connectionId,
  payload = {},
  { businessId, locationId = null } = {}
) {
  const connection = await connectionForBusiness(connectionId, businessId);
  const token = await bearer(connection);
  const parent = locationName(connection);
  const pageSize = Math.max(1, Math.min(50, Number(payload.pageSize) || 50));
  const maxPages = Math.max(1, Math.min(MAX_REVIEW_PAGES, Number(payload.maxPages) || 10));
  let pageToken = "";
  const ingested = [];
  let page = 0;

  do {
    const url = new URL(`${GBP_REVIEW_BASE}/${parent}/reviews`);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const { body } = await requestJson(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const reviews = Array.isArray(body.reviews) ? body.reviews : [];
    for (const review of reviews) {
      const mapped = mapReview(review, connection, businessId, locationId);
      const stored = await ExternalReputationItem.findOneAndUpdate(
        { business: businessId, provider: mapped.provider, externalId: mapped.externalId },
        { $set: mapped },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      ingested.push(stored);
    }
    pageToken = text(body.nextPageToken || body.next_page_token, 2000);
    page += 1;
  } while (pageToken && page < maxPages);

  connection.lastSyncAt = new Date();
  connection.status = "connected";
  await connection.save();

  return {
    provider: "google_business_profile",
    connectionId: String(connection._id),
    locationName: parent,
    reviews: ingested.map((item) => item.toObject()),
    synced: ingested.length,
    pages: page,
    nextPageTokenRemaining: Boolean(pageToken),
  };
}

export async function publishApprovedGoogleReviewReply(
  reviewId,
  { businessId, actorUser = null } = {}
) {
  objectId(reviewId, "review");
  const review = await ExternalReputationItem.findOne({
    _id: reviewId,
    business: businessId,
    provider: "google_business_profile",
    status: "active",
  });
  if (!review) throw createServiceError("External Google review not found.", 404);
  const response = await ExternalReputationResponse.findOne({ business: businessId, review: review._id });
  if (!response) throw createServiceError("External review response draft not found.", 404);
  if (response.status !== "approved") {
    throw createServiceError("External review response must be explicitly approved before publication.", 409, {
      code: "EXTERNAL_REVIEW_RESPONSE_APPROVAL_REQUIRED",
    });
  }
  const connection = await connectionForBusiness(review.connection, businessId);
  const token = await bearer(connection);
  const reviewResource = `${locationName(connection)}/reviews/${encodeURIComponent(review.externalId)}`;
  response.status = "publishing";
  response.updatedBy = actorId(actorUser) || response.updatedBy;
  await response.save();

  try {
    const { body } = await requestJson(`${GBP_REVIEW_BASE}/${reviewResource}/reply`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ comment: response.responseText }),
    }, 1);
    response.status = "published";
    response.publishedBy = actorId(actorUser);
    response.publishedAt = new Date();
    response.providerState = text(body.reviewReplyState || body.review_reply_state || "pending", 80).toLowerCase();
    response.providerReference = reviewResource;
    response.failureMessage = "";
    await response.save();
    return response.toObject();
  } catch (error) {
    response.status = "failed";
    response.failureMessage = text(error?.message || error, 2000);
    response.updatedBy = actorId(actorUser) || response.updatedBy;
    await response.save();
    throw error;
  }
}

export const GOOGLE_BUSINESS_PROFILE_ENDPOINTS = Object.freeze({
  reviews: GBP_REVIEW_BASE,
  oauthToken: GOOGLE_TOKEN_ENDPOINT,
});

export default {
  GOOGLE_BUSINESS_PROFILE_ENDPOINTS,
  publishApprovedGoogleReviewReply,
  syncGoogleBusinessProfileReviews,
};
