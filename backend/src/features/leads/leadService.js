import { createHash } from "node:crypto";
import mongoose from "mongoose";

import Customer from "../../models/customer.js";
import Lead, {
  LEAD_SOURCE_CHANNELS,
  LEAD_STATUSES,
} from "../../models/Lead.js";
import LeadScore from "../../models/LeadScore.js";
import LeadTimelineEvent, {
  LEAD_TIMELINE_EVENT_TYPES,
} from "../../models/LeadTimelineEvent.js";
import Opportunity, {
  OPPORTUNITY_STAGES,
} from "../../models/Opportunity.js";
import {
  recordDomainEvent,
} from "../integrationPlatform/webhookProjectionService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const TERMINAL_LEAD_STATUSES = new Set([
  "converted",
  "disqualified",
  "lost",
]);

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function lower(value) {
  return text(value).toLowerCase();
}

function email(value) {
  const normalised = lower(value);
  if (normalised && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    throw createServiceError("Lead email is invalid.", 400, { field: "email" });
  }
  return normalised;
}

function currency(value) {
  const result = text(value || "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) {
    throw createServiceError("currency must be a three-letter code.", 400, {
      field: "currency",
    });
  }
  return result;
}

function nonNegative(value, field, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw createServiceError(`${field} must be a non-negative number.`, 400, {
      field,
    });
  }
  return number;
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

function enumValue(value, field, allowed, fallback) {
  const result = lower(value || fallback).replaceAll("-", "_");
  if (!allowed.includes(result)) {
    throw createServiceError(`${field} must be one of: ${allowed.join(", ")}.`, 400, {
      field,
    });
  }
  return result;
}

function sourceKey(source = {}) {
  const externalReference = text(source.externalReference);
  if (!externalReference) return "";
  const namespace = lower(source.system || source.channel || "other");
  return createHash("sha256")
    .update(`${namespace}:${externalReference}`)
    .digest("hex");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function actorId(value) {
  return mongoose.isValidObjectId(value) ? value : null;
}

function normaliseSource(payload = {}) {
  const source = payload.source && typeof payload.source === "object"
    ? payload.source
    : {};
  const channel = enumValue(
    source.channel || payload.sourceChannel,
    "source.channel",
    LEAD_SOURCE_CHANNELS,
    "other"
  );
  return {
    channel,
    system: lower(source.system || payload.sourceSystem),
    campaign: text(source.campaign || payload.sourceCampaign),
    medium: text(source.medium || payload.sourceMedium),
    externalReference: text(
      source.externalReference || payload.externalReference
    ),
  };
}

async function leadForBusiness(leadId, businessId, session = null) {
  objectId(leadId, "lead");
  objectId(businessId, "business");
  let query = Lead.findOne({ _id: leadId, business: businessId });
  if (session) query = query.session(session);
  return assertFound(await query, "Lead not found.");
}

async function opportunityForLead(
  opportunityId,
  leadId,
  businessId,
  session = null
) {
  objectId(opportunityId, "opportunity");
  let query = Opportunity.findOne({
    _id: opportunityId,
    lead: leadId,
    business: businessId,
  });
  if (session) query = query.session(session);
  return assertFound(await query, "Opportunity not found.");
}

async function appendTimeline(
  {
    businessId,
    leadId,
    opportunityId = null,
    type,
    channel = "",
    summary,
    actorUser = null,
    occurredAt = new Date(),
    metadata = {},
  },
  { session = null } = {}
) {
  const eventType = enumValue(
    type,
    "timeline.type",
    LEAD_TIMELINE_EVENT_TYPES,
    "note"
  );
  const document = {
    business: businessId,
    lead: leadId,
    opportunity: opportunityId || null,
    type: eventType,
    channel: lower(channel),
    summary: text(summary) || eventType.replaceAll("_", " "),
    actorUser: actorId(actorUser),
    occurredAt,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
  if (session) {
    const [created] = await LeadTimelineEvent.create([document], { session });
    return created;
  }
  return LeadTimelineEvent.create(document);
}

async function emitLeadEvent(
  type,
  lead,
  payload,
  { session = null, correlationId = "" } = {}
) {
  return recordDomainEvent(
    {
      businessId: String(lead.business),
      type,
      version: "1",
      aggregateType: "lead",
      aggregateId: String(lead._id),
      payload,
      source: "crm-lead",
      correlationId,
    },
    { session }
  );
}

function dedupeFilter({ businessId, leadEmail, phone, idempotencyKey, sourceKeyValue }) {
  if (idempotencyKey) {
    return { business: businessId, idempotencyKey };
  }
  if (sourceKeyValue) {
    return { business: businessId, sourceKey: sourceKeyValue };
  }

  const identity = [];
  if (leadEmail) identity.push({ email: leadEmail });
  if (phone) identity.push({ phone });
  return identity.length
    ? {
        business: businessId,
        status: { $nin: [...TERMINAL_LEAD_STATUSES] },
        $or: identity,
      }
    : null;
}

export async function captureLead(
  payload = {},
  { businessId, locationId = null, actorUser = null } = {}
) {
  objectId(businessId, "business");
  const leadEmail = email(payload.email);
  const phone = text(payload.phone);
  const firstName = text(payload.firstName);
  const lastName = text(payload.lastName);

  if (!leadEmail && !phone) {
    throw createServiceError(
      "Lead capture requires an email address or phone number.",
      400,
      { field: "email" }
    );
  }

  const source = normaliseSource(payload);
  const sourceKeyValue = sourceKey(source);
  const idempotencyKey = text(payload.idempotencyKey);
  const duplicateFilter = dedupeFilter({
    businessId,
    leadEmail,
    phone,
    idempotencyKey,
    sourceKeyValue,
  });

  if (duplicateFilter) {
    const existing = await Lead.findOne(duplicateFilter).lean();
    if (existing) {
      return {
        lead: existing,
        created: false,
        deduplicated: true,
      };
    }
  }

  const databaseSession = await mongoose.startSession();
  let leadId = null;
  try {
    await databaseSession.withTransaction(async () => {
      const [lead] = await Lead.create(
        [
          {
            business: businessId,
            location: objectId(locationId || payload.location, "location", {
              optional: true,
            }),
            firstName,
            lastName,
            email: leadEmail,
            phone,
            status: "new",
            source,
            sourceKey: sourceKeyValue,
            idempotencyKey,
            interestedServices: Array.isArray(payload.interestedServices)
              ? payload.interestedServices.filter((id) => mongoose.isValidObjectId(id))
              : [],
            estimatedValue: nonNegative(payload.estimatedValue, "estimatedValue"),
            currency: currency(payload.currency),
            assignedUser: objectId(payload.assignedUser, "assignedUser", {
              optional: true,
            }),
            notes: text(payload.notes),
            metadata: payload.metadata || {},
          },
        ],
        { session: databaseSession }
      );
      leadId = lead._id;

      await appendTimeline(
        {
          businessId,
          leadId: lead._id,
          type: "captured",
          channel: source.channel,
          summary: `Lead captured from ${source.channel}.`,
          actorUser,
          metadata: {
            sourceSystem: source.system,
            sourceCampaign: source.campaign,
          },
        },
        { session: databaseSession }
      );

      await emitLeadEvent(
        "lead.captured",
        lead,
        {
          leadId: String(lead._id),
          sourceChannel: source.channel,
          sourceSystem: source.system,
          locationId: lead.location ? String(lead.location) : "",
        },
        { session: databaseSession }
      );
    });
  } finally {
    await databaseSession.endSession();
  }

  return {
    lead: await Lead.findById(leadId).lean(),
    created: true,
    deduplicated: false,
  };
}

export async function listLeads(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) {
    match.status = enumValue(query.status, "status", LEAD_STATUSES, "new");
  }
  if (query.sourceChannel) {
    match["source.channel"] = enumValue(
      query.sourceChannel,
      "sourceChannel",
      LEAD_SOURCE_CHANNELS,
      "other"
    );
  }
  if (query.assignedUser) {
    match.assignedUser = objectId(query.assignedUser, "assignedUser");
  }
  if (query.scoreBand) {
    const band = lower(query.scoreBand);
    if (!["cold", "warm", "hot"].includes(band)) {
      throw createServiceError("scoreBand is invalid.", 400, {
        field: "scoreBand",
      });
    }
    match.scoreBand = band;
  }
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

export async function getLeadAggregate(leadId, { businessId } = {}) {
  const lead = await leadForBusiness(leadId, businessId);
  const [timeline, opportunities, scores] = await Promise.all([
    LeadTimelineEvent.find({ business: businessId, lead: lead._id })
      .populate("actorUser", "name email")
      .sort({ occurredAt: 1, _id: 1 })
      .lean(),
    Opportunity.find({ business: businessId, lead: lead._id })
      .populate("customer", "firstName lastName email phone")
      .populate("location", "name")
      .populate("service", "name price duration")
      .populate("ownerUser", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .lean(),
    LeadScore.find({ business: businessId, lead: lead._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(25)
      .lean(),
  ]);

  return {
    lead: await Lead.findById(lead._id)
      .populate("customer", "firstName lastName email phone")
      .populate("location", "name")
      .populate("assignedUser", "name email")
      .populate("interestedServices", "name price duration")
      .lean(),
    timeline,
    opportunities,
    scores,
  };
}

export async function updateLead(
  leadId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  const previousStatus = lead.status;

  if (payload.firstName !== undefined) lead.firstName = text(payload.firstName);
  if (payload.lastName !== undefined) lead.lastName = text(payload.lastName);
  if (payload.email !== undefined) lead.email = email(payload.email);
  if (payload.phone !== undefined) lead.phone = text(payload.phone);
  if (payload.notes !== undefined) lead.notes = text(payload.notes);
  if (payload.status !== undefined) {
    lead.status = enumValue(payload.status, "status", LEAD_STATUSES, lead.status);
  }
  if (payload.assignedUser !== undefined) {
    lead.assignedUser = objectId(payload.assignedUser, "assignedUser", {
      optional: true,
    });
  }
  if (payload.interestedServices !== undefined) {
    lead.interestedServices = Array.isArray(payload.interestedServices)
      ? payload.interestedServices.filter((id) => mongoose.isValidObjectId(id))
      : [];
  }
  if (payload.estimatedValue !== undefined) {
    lead.estimatedValue = nonNegative(payload.estimatedValue, "estimatedValue");
  }
  if (payload.currency !== undefined) lead.currency = currency(payload.currency);
  if (payload.metadata !== undefined) lead.metadata = payload.metadata || {};
  if (payload.lostReason !== undefined) lead.lostReason = text(payload.lostReason);
  if (payload.disqualifiedReason !== undefined) {
    lead.disqualifiedReason = text(payload.disqualifiedReason);
  }

  if (lead.status === "converted" && !lead.customer) {
    throw createServiceError(
      "Use the lead conversion workflow to mark a lead converted.",
      409
    );
  }

  await lead.save();

  if (previousStatus !== lead.status) {
    await appendTimeline({
      businessId,
      leadId: lead._id,
      type: "status_changed",
      summary: `Lead status changed from ${previousStatus} to ${lead.status}.`,
      actorUser,
      metadata: { from: previousStatus, to: lead.status },
    });
  }

  await emitLeadEvent("lead.updated", lead, {
    leadId: String(lead._id),
    status: lead.status,
    score: lead.currentScore,
    scoreBand: lead.scoreBand,
  });

  return getLeadAggregate(lead._id, { businessId });
}

export async function addLeadTimelineEvent(
  leadId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  const event = await appendTimeline({
    businessId,
    leadId: lead._id,
    opportunityId: objectId(payload.opportunity, "opportunity", {
      optional: true,
    }),
    type: payload.type || "note",
    channel: payload.channel,
    summary: payload.summary,
    actorUser,
    occurredAt: date(payload.occurredAt, "occurredAt") || new Date(),
    metadata: payload.metadata || {},
  });
  return event.toObject();
}

function ruleScore(lead) {
  const factors = [];
  let score = 10;
  const add = (key, condition, contribution, reason) => {
    if (!condition) return;
    score += contribution;
    factors.push({ key, value: true, contribution, reason });
  };

  add("email", Boolean(lead.email), 20, "Email contact is available.");
  add("phone", Boolean(lead.phone), 20, "Phone contact is available.");
  add(
    "service_interest",
    Array.isArray(lead.interestedServices) && lead.interestedServices.length > 0,
    15,
    "At least one service interest is recorded."
  );
  add(
    "estimated_value",
    Number(lead.estimatedValue || 0) > 0,
    15,
    "An estimated opportunity value is recorded."
  );
  add(
    "owned",
    Boolean(lead.assignedUser),
    10,
    "The lead has an assigned owner."
  );
  add(
    "qualified_source",
    !["import", "other"].includes(lead.source?.channel),
    10,
    "The lead source has direct acquisition context."
  );

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    factors,
    explanation: "Deterministic lead qualification score v1.",
    features: {
      hasEmail: Boolean(lead.email),
      hasPhone: Boolean(lead.phone),
      interestedServiceCount: lead.interestedServices?.length || 0,
      estimatedValue: Number(lead.estimatedValue || 0),
      assigned: Boolean(lead.assignedUser),
      sourceChannel: lead.source?.channel || "other",
    },
  };
}

function scoreBand(score) {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export async function scoreLead(
  leadId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  const method = enumValue(
    payload.method,
    "method",
    ["rules", "manual", "ai"],
    "rules"
  );

  let result;
  if (method === "rules") {
    result = ruleScore(lead);
  } else {
    const suppliedScore = Number(payload.score);
    if (!Number.isFinite(suppliedScore) || suppliedScore < 0 || suppliedScore > 100) {
      throw createServiceError("score must be between 0 and 100.", 400, {
        field: "score",
      });
    }
    result = {
      score: suppliedScore,
      factors: Array.isArray(payload.factors) ? payload.factors : [],
      explanation: text(payload.explanation),
      features: payload.features || {},
    };
  }

  const band = scoreBand(result.score);
  const snapshot = await LeadScore.create({
    business: businessId,
    lead: lead._id,
    score: result.score,
    band,
    method,
    version: text(payload.version || "1"),
    factors: result.factors,
    features: result.features,
    explanation: result.explanation,
    createdBy: actorId(actorUser),
  });

  lead.currentScore = result.score;
  lead.scoreBand = band;
  lead.lastScoredAt = new Date();
  await lead.save();

  await appendTimeline({
    businessId,
    leadId: lead._id,
    type: "scored",
    summary: `Lead scored ${result.score}/100 (${band}).`,
    actorUser,
    metadata: {
      scoreId: String(snapshot._id),
      method,
      version: snapshot.version,
    },
  });

  await emitLeadEvent("lead.scored", lead, {
    leadId: String(lead._id),
    score: result.score,
    band,
    method,
    version: snapshot.version,
  });

  return snapshot.toObject();
}

export async function createOpportunity(
  leadId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  if (TERMINAL_LEAD_STATUSES.has(lead.status)) {
    throw createServiceError(
      `A ${lead.status} lead cannot receive a new opportunity.`,
      409
    );
  }

  const opportunity = await Opportunity.create({
    business: businessId,
    lead: lead._id,
    customer: lead.customer || null,
    location: objectId(payload.location || lead.location, "location", {
      optional: true,
    }),
    service: objectId(payload.service, "service", { optional: true }),
    ownerUser: objectId(payload.ownerUser || lead.assignedUser, "ownerUser", {
      optional: true,
    }),
    title:
      text(payload.title) ||
      `Opportunity for ${text(lead.firstName) || text(lead.email) || String(lead._id)}`,
    status: "open",
    stage: enumValue(
      payload.stage,
      "stage",
      OPPORTUNITY_STAGES,
      lead.status === "qualified" ? "qualified" : "new"
    ),
    estimatedValue: nonNegative(
      payload.estimatedValue ?? lead.estimatedValue,
      "estimatedValue"
    ),
    currency: currency(payload.currency || lead.currency),
    probability: Math.max(0, Math.min(100, Number(payload.probability) || 0)),
    expectedCloseAt: date(payload.expectedCloseAt, "expectedCloseAt"),
    metadata: payload.metadata || {},
  });

  await appendTimeline({
    businessId,
    leadId: lead._id,
    opportunityId: opportunity._id,
    type: "opportunity_created",
    summary: `Opportunity created: ${opportunity.title}.`,
    actorUser,
    metadata: {
      stage: opportunity.stage,
      estimatedValue: opportunity.estimatedValue,
      currency: opportunity.currency,
    },
  });

  await emitLeadEvent("lead.opportunity_created", lead, {
    leadId: String(lead._id),
    opportunityId: String(opportunity._id),
    stage: opportunity.stage,
    estimatedValue: opportunity.estimatedValue,
    currency: opportunity.currency,
  });

  return opportunity.toObject();
}

export async function updateOpportunity(
  leadId,
  opportunityId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  const opportunity = await opportunityForLead(
    opportunityId,
    lead._id,
    businessId
  );
  const previousStage = opportunity.stage;

  if (payload.title !== undefined) opportunity.title = text(payload.title);
  if (payload.stage !== undefined) {
    opportunity.stage = enumValue(
      payload.stage,
      "stage",
      OPPORTUNITY_STAGES,
      opportunity.stage
    );
  }
  if (payload.estimatedValue !== undefined) {
    opportunity.estimatedValue = nonNegative(
      payload.estimatedValue,
      "estimatedValue"
    );
  }
  if (payload.currency !== undefined) opportunity.currency = currency(payload.currency);
  if (payload.probability !== undefined) {
    const probability = Number(payload.probability);
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      throw createServiceError("probability must be between 0 and 100.", 400, {
        field: "probability",
      });
    }
    opportunity.probability = probability;
  }
  if (payload.expectedCloseAt !== undefined) {
    opportunity.expectedCloseAt = date(payload.expectedCloseAt, "expectedCloseAt");
  }
  if (payload.ownerUser !== undefined) {
    opportunity.ownerUser = objectId(payload.ownerUser, "ownerUser", {
      optional: true,
    });
  }
  if (payload.service !== undefined) {
    opportunity.service = objectId(payload.service, "service", { optional: true });
  }
  if (payload.location !== undefined) {
    opportunity.location = objectId(payload.location, "location", {
      optional: true,
    });
  }
  if (payload.metadata !== undefined) opportunity.metadata = payload.metadata || {};

  if (opportunity.stage === "won") {
    opportunity.status = "won";
    opportunity.wonAt = opportunity.wonAt || new Date();
    opportunity.lostAt = null;
    opportunity.lostReason = "";
  } else if (opportunity.stage === "lost") {
    opportunity.status = "lost";
    opportunity.lostAt = opportunity.lostAt || new Date();
    opportunity.lostReason = text(payload.lostReason || opportunity.lostReason);
  } else {
    opportunity.status = "open";
    opportunity.wonAt = null;
    opportunity.lostAt = null;
    if (payload.lostReason !== undefined) opportunity.lostReason = "";
  }

  await opportunity.save();

  await appendTimeline({
    businessId,
    leadId: lead._id,
    opportunityId: opportunity._id,
    type: "opportunity_updated",
    summary: `Opportunity stage changed from ${previousStage} to ${opportunity.stage}.`,
    actorUser,
    metadata: {
      fromStage: previousStage,
      toStage: opportunity.stage,
      status: opportunity.status,
    },
  });

  await recordDomainEvent({
    businessId,
    type: "opportunity.updated",
    version: "1",
    aggregateType: "opportunity",
    aggregateId: String(opportunity._id),
    payload: {
      opportunityId: String(opportunity._id),
      leadId: String(lead._id),
      stage: opportunity.stage,
      status: opportunity.status,
    },
    source: "crm-lead",
  });

  return opportunity.toObject();
}

export async function setLeadNurture(
  leadId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  if (lead.status === "converted") {
    throw createServiceError(
      "Converted leads cannot be enrolled in lead nurture.",
      409
    );
  }

  const workflowKey = text(payload.workflowKey || lead.nurture?.workflowKey);
  if (!workflowKey) {
    throw createServiceError("workflowKey is required for lead nurture.", 400, {
      field: "workflowKey",
    });
  }
  const nurtureStatus = enumValue(
    payload.status,
    "nurture.status",
    ["pending", "enrolled", "paused", "completed", "cancelled"],
    "pending"
  );
  const firstEnrollment = !lead.nurture?.workflowKey;

  lead.nurture = {
    workflowKey,
    status: nurtureStatus,
    nextActionAt: date(payload.nextActionAt, "nextActionAt"),
    lastActionAt: new Date(),
  };
  if (!["completed", "cancelled"].includes(nurtureStatus)) {
    lead.status = "nurturing";
  }
  await lead.save();

  await appendTimeline({
    businessId,
    leadId: lead._id,
    type: firstEnrollment ? "nurture_enrolled" : "nurture_updated",
    summary: `Lead nurture ${nurtureStatus} for workflow ${workflowKey}.`,
    actorUser,
    metadata: {
      workflowKey,
      status: nurtureStatus,
      nextActionAt: lead.nurture.nextActionAt,
    },
  });

  return lead.toObject();
}

async function matchingCustomerIdentity(lead, businessId, session) {
  const identity = [];
  if (lead.email) identity.push({ email: lead.email });
  if (lead.phone) identity.push({ phone: lead.phone });
  if (identity.length === 0) return null;

  const matches = await Customer.find({
    status: { $ne: "deleted" },
    $or: identity,
  })
    .session(session);

  const uniqueMatches = [
    ...new Map(matches.map((customer) => [String(customer._id), customer])).values(),
  ];
  if (uniqueMatches.length > 1) {
    throw createServiceError(
      "Lead identity matches more than one customer and requires manual resolution.",
      409,
      { code: "CUSTOMER_IDENTITY_CONFLICT" }
    );
  }

  const customer = uniqueMatches[0] || null;
  if (!customer) return null;

  if (!customer.business) {
    throw createServiceError(
      "The matching customer has unresolved tenant ownership; resolve ownership before conversion.",
      409,
      { code: "CUSTOMER_TENANT_OWNERSHIP_UNRESOLVED" }
    );
  }
  if (String(customer.business) !== String(businessId)) {
    throw createServiceError(
      "The matching customer belongs to another business and cannot be linked automatically.",
      409,
      { code: "CUSTOMER_IDENTITY_OWNED_BY_ANOTHER_BUSINESS" }
    );
  }
  return customer;
}

export async function convertLeadToCustomer(
  leadId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  objectId(businessId, "business");
  const databaseSession = await mongoose.startSession();
  let customerId = null;
  let customerCreated = false;

  try {
    await databaseSession.withTransaction(async () => {
      const lead = await leadForBusiness(leadId, businessId, databaseSession);
      if (lead.customer) {
        customerId = lead.customer;
        return;
      }

      let customer = await matchingCustomerIdentity(
        lead,
        businessId,
        databaseSession
      );

      if (!customer) {
        const firstName = text(payload.firstName || lead.firstName);
        const lastName = text(payload.lastName || lead.lastName);
        if (!firstName || !lastName) {
          throw createServiceError(
            "First and last name are required to convert a new lead into a customer.",
            400,
            { field: "firstName" }
          );
        }

        [customer] = await Customer.create(
          [
            {
              business: businessId,
              firstName,
              lastName,
              email: lead.email || undefined,
              phone: lead.phone || undefined,
              notes: text(payload.customerNotes || lead.notes),
              createdBy: actorId(actorUser),
              updatedBy: actorId(actorUser),
            },
          ],
          { session: databaseSession }
        );
        customerCreated = true;
      }

      customerId = customer._id;
      lead.customer = customer._id;
      lead.status = "converted";
      lead.convertedAt = new Date();
      lead.nurture = {
        workflowKey: lead.nurture?.workflowKey || "",
        status: "completed",
        nextActionAt: null,
        lastActionAt: new Date(),
      };
      await lead.save({ session: databaseSession });

      await Opportunity.updateMany(
        {
          business: businessId,
          lead: lead._id,
          customer: null,
        },
        { $set: { customer: customer._id } },
        { session: databaseSession }
      );

      await appendTimeline(
        {
          businessId,
          leadId: lead._id,
          type: "customer_converted",
          summary: customerCreated
            ? "Lead converted into a new canonical customer."
            : "Lead linked to an existing canonical customer.",
          actorUser,
          metadata: {
            customerId: String(customer._id),
            customerCreated,
          },
        },
        { session: databaseSession }
      );

      if (customerCreated) {
        await recordDomainEvent(
          {
            businessId,
            type: "customer.created",
            version: "1",
            aggregateType: "customer",
            aggregateId: String(customer._id),
            payload: {
              customerId: String(customer._id),
              source: "lead_conversion",
              leadId: String(lead._id),
            },
            source: "crm-lead",
          },
          { session: databaseSession }
        );
      }

      await emitLeadEvent(
        "lead.converted",
        lead,
        {
          leadId: String(lead._id),
          customerId: String(customer._id),
          customerCreated,
          sourceChannel: lead.source?.channel || "other",
        },
        { session: databaseSession }
      );
    });
  } finally {
    await databaseSession.endSession();
  }

  return {
    lead: await Lead.findOne({ _id: leadId, business: businessId }).lean(),
    customer: customerId ? await Customer.findById(customerId).lean() : null,
    customerCreated,
  };
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
