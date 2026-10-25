import { createHash } from "node:crypto";
import mongoose from "mongoose";

import Lead, {
  LEAD_SOURCE_CHANNELS,
  LEAD_STATUSES,
} from "../../models/Lead.js";
import Opportunity from "../../models/Opportunity.js";
import { createServiceError } from "../../shared/serviceError.js";
import * as base from "./leadService.js";

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function scope({ businessId, locationId } = {}) {
  objectId(businessId, "business");
  objectId(locationId, "location");
  return { business: businessId, location: locationId };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normaliseEnum(value, allowed, field) {
  const candidate = text(value).toLowerCase().replaceAll("-", "_");
  if (!allowed.includes(candidate)) {
    throw createServiceError(`${field} is invalid.`, 400, { field });
  }
  return candidate;
}

async function leadAtLocation(leadId, authority, session = null) {
  objectId(leadId, "lead");
  const locationScope = scope(authority);
  let query = Lead.findOne({ _id: leadId, ...locationScope });
  if (session) query = query.session(session);
  const lead = await query;
  if (!lead) {
    throw createServiceError("Lead not found for the selected location.", 404, {
      code: "LEAD_LOCATION_NOT_FOUND",
    });
  }
  return lead;
}

async function opportunityAtLocation(opportunityId, leadId, authority) {
  objectId(opportunityId, "opportunity");
  const locationScope = scope(authority);
  const opportunity = await Opportunity.findOne({
    _id: opportunityId,
    lead: leadId,
    ...locationScope,
  });
  if (!opportunity) {
    throw createServiceError("Opportunity not found for the selected location.", 404, {
      code: "OPPORTUNITY_LOCATION_NOT_FOUND",
    });
  }
  return opportunity;
}

function scopedIdempotencyKey(payload, locationId) {
  const source = payload?.source && typeof payload.source === "object" ? payload.source : {};
  const seed = [
    String(locationId),
    text(payload?.idempotencyKey),
    text(source.system || payload?.sourceSystem),
    text(source.externalReference || payload?.externalReference),
    text(payload?.email).toLowerCase(),
    text(payload?.phone),
  ].join("|");
  return `loc_${createHash("sha256").update(seed).digest("hex")}`;
}

export async function captureLead(payload = {}, { businessId, locationId, actorUser = null } = {}) {
  scope({ businessId, locationId });
  return base.captureLead(
    {
      ...payload,
      location: locationId,
      idempotencyKey: scopedIdempotencyKey(payload, locationId),
    },
    { businessId, locationId, actorUser }
  );
}

export async function listLeads(query = {}, { businessId, locationId } = {}) {
  const match = scope({ businessId, locationId });
  if (query.status) match.status = normaliseEnum(query.status, LEAD_STATUSES, "status");
  if (query.sourceChannel) {
    match["source.channel"] = normaliseEnum(query.sourceChannel, LEAD_SOURCE_CHANNELS, "sourceChannel");
  }
  if (query.assignedUser) match.assignedUser = objectId(query.assignedUser, "assignedUser");
  if (query.scoreBand) match.scoreBand = normaliseEnum(query.scoreBand, ["cold", "warm", "hot"], "scoreBand");
  if (query.search) {
    const pattern = new RegExp(escapeRegExp(text(query.search)), "i");
    match.$or = [
      { firstName: pattern },
      { lastName: pattern },
      { email: pattern },
      { phone: pattern },
    ];
  }
  const limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
  return Lead.find(match)
    .populate("customer", "firstName lastName email phone")
    .populate("location", "name")
    .populate("assignedUser", "name email")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export async function getLeadAggregate(leadId, { businessId, locationId } = {}) {
  await leadAtLocation(leadId, { businessId, locationId });
  const aggregate = await base.getLeadAggregate(leadId, { businessId });
  return {
    ...aggregate,
    opportunities: (aggregate.opportunities || []).filter(
      (item) => String(item.location?._id || item.location || "") === String(locationId)
    ),
  };
}

export async function updateLead(leadId, payload = {}, { businessId, locationId, actorUser = null } = {}) {
  await leadAtLocation(leadId, { businessId, locationId });
  return base.updateLead(leadId, payload, { businessId, actorUser });
}

export async function addLeadTimelineEvent(leadId, payload = {}, { businessId, locationId, actorUser = null } = {}) {
  await leadAtLocation(leadId, { businessId, locationId });
  return base.addLeadTimelineEvent(leadId, payload, { businessId, actorUser });
}

export async function scoreLead(leadId, payload = {}, { businessId, locationId, actorUser = null } = {}) {
  await leadAtLocation(leadId, { businessId, locationId });
  return base.scoreLead(leadId, payload, { businessId, actorUser });
}

export async function setLeadNurture(leadId, payload = {}, { businessId, locationId, actorUser = null } = {}) {
  await leadAtLocation(leadId, { businessId, locationId });
  return base.setLeadNurture(leadId, payload, { businessId, actorUser });
}

export async function createOpportunity(leadId, payload = {}, { businessId, locationId, actorUser = null } = {}) {
  await leadAtLocation(leadId, { businessId, locationId });
  return base.createOpportunity(
    leadId,
    { ...payload, location: locationId },
    { businessId, actorUser }
  );
}

export async function updateOpportunity(
  leadId,
  opportunityId,
  payload = {},
  { businessId, locationId, actorUser = null } = {}
) {
  await leadAtLocation(leadId, { businessId, locationId });
  await opportunityAtLocation(opportunityId, leadId, { businessId, locationId });
  if (payload.location && String(payload.location) !== String(locationId)) {
    throw createServiceError("An opportunity cannot be moved to another location.", 409, {
      code: "OPPORTUNITY_LOCATION_IMMUTABLE",
    });
  }
  return base.updateOpportunity(
    leadId,
    opportunityId,
    { ...payload, location: locationId },
    { businessId, actorUser }
  );
}

export async function convertLeadToCustomer(leadId, payload = {}, { businessId, locationId, actorUser = null } = {}) {
  await leadAtLocation(leadId, { businessId, locationId });
  return base.convertLeadToCustomer(leadId, payload, { businessId, actorUser });
}

export default {
  addLeadTimelineEvent,
  captureLead,
  convertLeadToCustomer,
  createOpportunity,
  getLeadAggregate,
  listLeads,
  scoreLead,
  setLeadNurture,
  updateLead,
  updateOpportunity,
};
