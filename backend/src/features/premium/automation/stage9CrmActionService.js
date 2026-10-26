import mongoose from "mongoose";

import Customer from "../../../models/customer.js";
import Location from "../../../models/Location.js";
import CrmActionDraft from "./CrmActionDraft.js";
import { listPoint9RetentionOpportunities } from "./stage9Customer360Service.js";
import { listRetentionQueue, point9AuthorityScope } from "./stage9CrmService.js";

function actionError(message, statusCode = 400, code = "POINT9_CRM_ACTION_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function idText(value) {
  return value ? String(value?._id || value).trim() : "";
}

function assertObjectId(value, label) {
  const text = idText(value);
  if (!mongoose.isValidObjectId(text)) {
    throw actionError(`${label} is invalid.`, 400, "POINT9_INVALID_ID");
  }
  return text;
}

async function resolveLocation(scope, requestedLocationId) {
  const locationId = assertObjectId(requestedLocationId, "Location");
  if (
    Array.isArray(scope.allowedLocationIds) &&
    !scope.allowedLocationIds.map(idText).includes(locationId)
  ) {
    throw actionError(
      "The requested location is outside the caller's effective authority.",
      403,
      "POINT9_LOCATION_FORBIDDEN"
    );
  }

  const location = await Location.findOne({
    _id: locationId,
    business: scope.businessId,
  })
    .select("_id name")
    .lean();

  if (!location) {
    throw actionError(
      "The requested location does not belong to the active business.",
      404,
      "POINT9_LOCATION_NOT_FOUND"
    );
  }
  return location;
}

function firstName(customer) {
  return customer.preferredName || customer.firstName || "there";
}

function defaultDraft({ type, customer, retention }) {
  const name = firstName(customer);
  switch (type) {
    case "reactivation":
      return {
        subject: "We'd love to welcome you back",
        body: `Hi ${name}, it has been a little while since your last visit. We would be delighted to welcome you back. Please contact the salon when you are ready and we can help you find a suitable appointment.`,
      };
    case "birthday":
      return {
        subject: "Happy birthday from the salon",
        body: `Hi ${name}, happy birthday from all of us at the salon. We hope you have a wonderful day.`,
      };
    case "referral":
      return {
        subject: "Your salon referral code",
        body: `Hi ${name}, your referral code is ${customer.referralCode || "available in your salon profile"}. Share it only if you would like to recommend the salon to someone you know.`,
      };
    case "loyalty":
      return {
        subject: "Your salon loyalty balance",
        body: `Hi ${name}, your salon profile currently records ${Number(customer.loyaltyPoints || 0)} loyalty points. Ask the salon team how your current balance can be used.`,
      };
    case "rebooking":
    default:
      return {
        subject: "Time to plan your next salon visit",
        body: `Hi ${name}, based on your recent visit pattern it may be time to plan your next salon appointment${retention?.dueAt ? ` around ${new Date(retention.dueAt).toLocaleDateString("en-GB")}` : ""}. Contact the salon and we can help you rebook.`,
      };
  }
}

async function loadCustomer(customerId, businessId) {
  const id = assertObjectId(customerId, "Customer");
  const customer = await Customer.findOne({
    _id: id,
    business: businessId,
    status: { $ne: "deleted" },
  })
    .select(
      "firstName lastName preferredName email phone dateOfBirth communicationPreferences marketing referralCode loyaltyPoints status"
    )
    .lean();
  if (!customer) {
    throw actionError("Customer was not found in the active business.", 404, "POINT9_CUSTOMER_NOT_FOUND");
  }
  return customer;
}

function marketingChannelEligible(customer, channel) {
  const preferences = customer.communicationPreferences || {};
  const marketing = customer.marketing || {};
  if (preferences.unsubscribed === true) return false;

  if (channel === "email") {
    return Boolean(
      customer.email &&
      preferences.emailMarketing === true &&
      preferences.emailUnsubscribed !== true &&
      marketing.emailConsent === true &&
      marketing.emailSuppressed !== true
    );
  }
  if (channel === "sms") {
    return Boolean(
      customer.phone &&
      preferences.smsMarketing === true &&
      preferences.smsUnsubscribed !== true &&
      marketing.smsConsent === true
    );
  }
  if (channel === "whatsapp") {
    return Boolean(
      customer.phone &&
      preferences.whatsappMarketing === true &&
      preferences.whatsappUnsubscribed !== true &&
      marketing.whatsappConsent === true
    );
  }
  return true;
}

function assertChannelEligible(customer, channel) {
  if (channel === "email" && !customer.email) {
    throw actionError("Customer has no email address for an email draft.", 409, "POINT9_CHANNEL_UNAVAILABLE");
  }
  if (["sms", "whatsapp", "phone"].includes(channel) && !customer.phone) {
    throw actionError("Customer has no phone number for this draft channel.", 409, "POINT9_CHANNEL_UNAVAILABLE");
  }
  if (["email", "sms", "whatsapp"].includes(channel) && !marketingChannelEligible(customer, channel)) {
    throw actionError(
      "The customer has not granted current marketing consent for this provider channel.",
      409,
      "POINT9_MARKETING_CONSENT_REQUIRED"
    );
  }
}

export async function createPoint9CrmActionDraft(
  payload = {},
  { tenantContext = {}, effectiveAuthority = {}, actorId = null } = {}
) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const type = String(payload.opportunityType || "").trim();
  const channel = String(payload.channel || "").trim();
  if (!["rebooking", "reactivation", "birthday", "referral", "loyalty"].includes(type)) {
    throw actionError("A supported CRM opportunity type is required.", 400, "POINT9_ACTION_TYPE_REQUIRED");
  }
  if (!["email", "sms", "whatsapp", "in_person", "phone"].includes(channel)) {
    throw actionError("A supported draft channel is required.", 400, "POINT9_ACTION_CHANNEL_REQUIRED");
  }

  const [location, customer, opportunityResult, retentionResult] = await Promise.all([
    resolveLocation(scope, payload.locationId),
    loadCustomer(payload.customerId, scope.businessId),
    listPoint9RetentionOpportunities({
      tenantContext,
      effectiveAuthority,
      type,
      limit: 250,
    }),
    listRetentionQueue({ effectiveAuthority, limit: 500 }),
  ]);

  assertChannelEligible(customer, channel);

  const opportunity = opportunityResult.opportunities.find(
    (item) => idText(item.customerId) === idText(customer._id) && item.type === type
  );
  if (!opportunity) {
    throw actionError(
      "The requested CRM action is not supported by current deterministic customer evidence.",
      409,
      "POINT9_OPPORTUNITY_NOT_CURRENT"
    );
  }

  const retention = retentionResult.queue.find(
    (item) => idText(item.customerId) === idText(customer._id)
  );
  if (retention?.latestLocationId && idText(retention.latestLocationId) !== idText(location._id)) {
    throw actionError(
      "The action location must match the customer's latest authorised retention evidence.",
      409,
      "POINT9_ACTION_LOCATION_EVIDENCE_MISMATCH"
    );
  }

  const generated = defaultDraft({ type, customer, retention });
  const subject = String(payload.subject ?? generated.subject).trim().slice(0, 300);
  const body = String(payload.body ?? generated.body).trim().slice(0, 5000);
  if (!body) {
    throw actionError("Draft body is required.", 400, "POINT9_ACTION_BODY_REQUIRED");
  }

  const actor = mongoose.isValidObjectId(idText(actorId)) ? idText(actorId) : null;
  const draft = await CrmActionDraft.create({
    business: scope.businessId,
    location: location._id,
    customer: customer._id,
    opportunityType: type,
    channel,
    subject,
    body,
    status: "draft",
    evidence: {
      retentionState: retention?.retentionState || "",
      dueAt: retention?.dueAt || null,
      cadenceDays: retention?.cadenceDays ?? null,
      source: "point9_deterministic_opportunity",
    },
    executionAuthorised: false,
    createdBy: actor,
  });

  return draft.toObject();
}

export async function listPoint9CrmActionDrafts({
  effectiveAuthority = {},
  customerId = "",
  status = "",
  limit = 100,
} = {}) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const query = { business: scope.businessId };
  if (Array.isArray(scope.allowedLocationIds)) {
    query.location = { $in: scope.allowedLocationIds };
  }
  if (customerId) query.customer = assertObjectId(customerId, "Customer");
  if (status) query.status = status;
  const safeLimit = Math.min(250, Math.max(1, Number.parseInt(limit, 10) || 100));

  const drafts = await CrmActionDraft.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit)
    .populate("location", "name")
    .populate("customer", "firstName lastName preferredName email phone")
    .lean();

  return {
    drafts,
    count: drafts.length,
    executionAuthorised: false,
  };
}

export async function updatePoint9CrmActionDraft(
  draftId,
  payload = {},
  { effectiveAuthority = {}, actorId = null } = {}
) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const id = assertObjectId(draftId, "CRM action draft");
  const query = { _id: id, business: scope.businessId };
  if (Array.isArray(scope.allowedLocationIds)) {
    query.location = { $in: scope.allowedLocationIds };
  }
  const draft = await CrmActionDraft.findOne(query);
  if (!draft) {
    throw actionError("CRM action draft was not found in effective authority.", 404, "POINT9_ACTION_DRAFT_NOT_FOUND");
  }
  if (draft.status !== "draft") {
    throw actionError("Only draft CRM actions can be edited or resolved.", 409, "POINT9_ACTION_DRAFT_IMMUTABLE");
  }

  if (payload.subject !== undefined) draft.subject = String(payload.subject).trim().slice(0, 300);
  if (payload.body !== undefined) {
    const body = String(payload.body).trim().slice(0, 5000);
    if (!body) throw actionError("Draft body is required.", 400, "POINT9_ACTION_BODY_REQUIRED");
    draft.body = body;
  }
  const actor = mongoose.isValidObjectId(idText(actorId)) ? idText(actorId) : null;
  if (payload.status === "reviewed") {
    draft.status = "reviewed";
    draft.reviewedBy = actor;
    draft.reviewedAt = new Date();
  } else if (payload.status === "discarded") {
    draft.status = "discarded";
    draft.discardedBy = actor;
    draft.discardedAt = new Date();
  } else if (payload.status && payload.status !== "draft") {
    throw actionError("CRM drafts can only be marked reviewed or discarded.", 400, "POINT9_ACTION_STATUS_INVALID");
  }

  draft.executionAuthorised = false;
  await draft.save();
  return draft.toObject();
}
