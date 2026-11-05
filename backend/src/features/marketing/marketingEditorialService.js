import mongoose from "mongoose";
import Backlink from "../../models/MarketingBacklinkObservation.js";
import Placement from "../../models/MarketingEditorialPlacement.js";
import ContentPage from "../content/ContentPage.js";
import { createServiceError } from "../../shared/serviceError.js";

const STATES = Object.freeze({
  prospect: ["draft", "withdrawn"],
  draft: ["review", "withdrawn"],
  review: ["approved", "draft", "rejected"],
  approved: ["submitted", "withdrawn"],
  submitted: ["accepted", "rejected", "withdrawn"],
  accepted: ["published", "rejected", "withdrawn"],
  published: ["withdrawn"],
  rejected: ["draft"],
  withdrawn: [],
});

function objectId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw createServiceError(`Invalid ${label}.`, 422);
  return String(value);
}

export function marketingScope(authority) {
  if (!authority?.businessId || !authority?.locationId) {
    throw createServiceError("A trusted business and selected location are required.", 403);
  }
  return { business: objectId(authority.businessId, "business"), location: objectId(authority.locationId, "location") };
}

function httpsUrl(value, label) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw createServiceError(`Invalid ${label} URL.`, 422); }
  if (url.protocol !== "https:" || url.username || url.password) throw createServiceError(`${label} must be an HTTPS URL without credentials.`, 422);
  return url.toString();
}

function limitedText(value, max, label, required = false) {
  const result = String(value ?? "").trim();
  if (result.length > max || (required && !result)) throw createServiceError(`Invalid ${label}.`, 422);
  return result;
}

export function canAdvanceEditorial(current, target, record) {
  if (!STATES[current]?.includes(target)) return false;
  if (target === "approved") return record?.rightsConfirmed === true && record?.originalityReviewed === true;
  if (target === "submitted") return Boolean(record?.approvedBy && record?.approvedAt);
  if (target === "published") return Boolean(record?.publishedUrl && record?.publishedAt);
  return true;
}

export async function createEditorialPlacement(input, authority, actor) {
  const scope = marketingScope(authority);
  const contentPage = input.contentPage ? objectId(input.contentPage, "content page") : null;
  if (contentPage && !(await ContentPage.exists({ _id: contentPage, business: scope.business }))) {
    throw createServiceError("Content page not found for this business.", 404);
  }
  return Placement.create({
    ...scope,
    contentPage,
    workingTitle: limitedText(input.workingTitle, 220, "title", true),
    publisherName: limitedText(input.publisherName, 180, "publisher name", true),
    publisherWebsite: httpsUrl(input.publisherWebsite, "publisher website"),
    pitchSummary: limitedText(input.pitchSummary, 3000, "pitch summary"),
    createdBy: actor || null,
    updatedBy: actor || null,
  });
}

export async function listEditorialPlacements(authority, { status, limit = 50 } = {}) {
  const filter = marketingScope(authority);
  if (status) {
    if (!Object.hasOwn(STATES, status)) throw createServiceError("Invalid editorial status.", 422);
    filter.status = status;
  }
  return Placement.find(filter).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit) || 50))).lean();
}

export async function transitionEditorialPlacement(id, input, authority, actor) {
  const scope = marketingScope(authority);
  const record = await Placement.findOne({ _id: objectId(id, "placement"), ...scope });
  if (!record) throw createServiceError("Editorial placement not found.", 404);
  const target = String(input.status || "");
  if (target === "approved") {
    // Only verified content rights and editorial review permit approval.
    record.rightsConfirmed = input.rightsConfirmed === true;
    record.originalityReviewed = input.originalityReviewed === true;
    record.approvedAt = new Date();
    record.approvedBy = actor || null;
    if (!record.approvedBy) throw createServiceError("Approving user required.", 403);
  }
  if (target === "published") {
    record.publishedUrl = httpsUrl(input.publishedUrl, "published article");
    record.publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();
    if (!Number.isFinite(record.publishedAt.getTime())) throw createServiceError("Invalid publication date.", 422);
  }
  if (!canAdvanceEditorial(record.status, target, record)) {
    throw createServiceError("Editorial transition is not permitted or prerequisites are incomplete.", 409);
  }
  record.status = target;
  if (target === "submitted") record.submittedAt = new Date();
  record.updatedBy = actor || null;
  return record.save();
}

export async function recordManualBacklink(input, authority, actor) {
  const scope = marketingScope(authority);
  const sourceUrl = httpsUrl(input.sourceUrl, "source");
  const targetUrl = httpsUrl(input.targetUrl, "target");
  if (new URL(sourceUrl).hostname.toLowerCase() === new URL(targetUrl).hostname.toLowerCase()) {
    throw createServiceError("Internal links must not be recorded as external backlinks.", 422);
  }
  const when = new Date();
  return Backlink.create({
    ...scope,
    sourceUrl,
    targetUrl,
    sourceHost: new URL(sourceUrl).hostname.toLowerCase(),
    anchorText: limitedText(input.anchorText, 1000, "anchor text"),
    rel: [...new Set((Array.isArray(input.rel) ? input.rel : []).map(String))],
    discoveryMethod: "manual",
    observedAt: when,
    firstSeenAt: when,
    lastSeenAt: when,
    status: "observed",
    verificationMethod: "none",
    createdBy: actor || null,
  });
}

export async function listBacklinkObservations(authority, { limit = 50 } = {}) {
  return Backlink.find(marketingScope(authority))
    .sort({ observedAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit) || 50))).lean();
}

export function monthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))) throw createServiceError("Month must use YYYY-MM.", 422);
  const [year, number] = month.split("-").map(Number);
  if (year < 2000 || year > 2100) throw createServiceError("Month is out of range.", 422);
  return { start: new Date(Date.UTC(year, number - 1, 1)), end: new Date(Date.UTC(year, number, 1)) };
}

export async function monthlyBacklinkSummary(authority, month) {
  const scope = marketingScope(authority);
  const { start, end } = monthBounds(month);
  const match = {
    business: new mongoose.Types.ObjectId(scope.business),
    location: new mongoose.Types.ObjectId(scope.location),
    observedAt: { $gte: start, $lt: end },
  };
  const [counts, domains, publishedPlacements] = await Promise.all([
    Backlink.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        observedLinks: { $sum: 1 },
        verifiedLinks: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] } },
        lostObservations: { $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] } },
      } },
    ]),
    Backlink.aggregate([
      { $match: match },
      { $group: { _id: "$sourceHost" } },
      { $count: "distinctReferringDomains" },
    ]),
    Placement.countDocuments({
      ...scope, status: "published",
      publishedAt: { $gte: start, $lt: end },
    }),
  ]);
  return {
    month,
    observedLinks: counts[0]?.observedLinks || 0,
    distinctReferringDomains: domains[0]?.distinctReferringDomains || 0,
    verifiedLinks: counts[0]?.verifiedLinks || 0,
    lostObservations: counts[0]?.lostObservations || 0,
    publishedPlacements,
    evidenceBasis: "observations_in_period",
  };
}
