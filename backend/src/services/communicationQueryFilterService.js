import mongoose from "mongoose";

const MAX_SEARCH_LENGTH = 200;
const MAX_FILTER_LENGTH = 100;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

function invalidQueryFilter(field, message) {
  const error = new Error(message || `${field} contains an invalid query filter value.`);
  error.statusCode = 400;
  error.code = "INVALID_COMMUNICATION_QUERY_FILTER";
  error.field = field;
  return error;
}

function scalarString(
  value,
  field,
  { maxLength = MAX_FILTER_LENGTH, lowercase = false } = {}
) {
  if (value === undefined || value === null || value === "") return "";

  if (typeof value !== "string") {
    throw invalidQueryFilter(field, `${field} must be a single string value.`);
  }

  const normalised = String(value).trim();
  if (!normalised) return "";
  if (normalised.length > maxLength) {
    throw invalidQueryFilter(
      field,
      `${field} cannot exceed ${maxLength} characters.`
    );
  }

  return lowercase ? normalised.toLowerCase() : normalised;
}

function scalarBoolean(value, field) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;

  const normalised = scalarString(value, field, { maxLength: 5 }).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalised)) return true;
  if (["false", "0", "no", "off"].includes(normalised)) return false;

  throw invalidQueryFilter(field, `${field} must be a boolean value.`);
}

function scalarDate(value, field, { endOfDay = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const normalised = scalarString(value, field, { maxLength: 64 });
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) {
    throw invalidQueryFilter(field, `${field} must be a valid date.`);
  }
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export function communicationObjectId(value, field = "id") {
  if (value === undefined || value === null || value === "") return null;
  const normalised = scalarString(value, field, { maxLength: 24 });

  if (!OBJECT_ID_PATTERN.test(normalised)) {
    throw invalidQueryFilter(field, `${field} must be a valid identifier.`);
  }

  return new mongoose.Types.ObjectId(normalised);
}

export function buildCommunicationCampaignFilter(query = {}) {
  const filter = {};
  const search = scalarString(query.search, "search", {
    maxLength: MAX_SEARCH_LENGTH,
  });
  if (search) filter.$text = { $search: search };

  const status = scalarString(query.status, "status");
  const campaignType = scalarString(query.campaignType, "campaignType");
  const channel = scalarString(query.channel, "channel");
  const sendMode = scalarString(query.sendMode, "sendMode");
  const createdBy = communicationObjectId(query.createdBy, "createdBy");

  if (status) filter.status = status;
  if (campaignType) filter.campaignType = campaignType;
  if (channel) filter.channel = channel;
  if (sendMode) filter["schedule.mode"] = sendMode;
  if (createdBy) filter.createdBy = createdBy;

  const start = scalarDate(query.startDate, "startDate");
  const end = scalarDate(query.endDate, "endDate", { endOfDay: true });
  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
  }

  return filter;
}

export function buildCommunicationTemplateFilter(query = {}) {
  const filter = {};
  const search = scalarString(query.search, "search", {
    maxLength: MAX_SEARCH_LENGTH,
  });
  if (search) filter.$text = { $search: search };

  const campaignType = scalarString(query.campaignType, "campaignType");
  const channel = scalarString(query.channel, "channel");
  const createdBy = communicationObjectId(query.createdBy, "createdBy");
  const tag = scalarString(query.tag, "tag", { lowercase: true });
  const active = scalarBoolean(query.active, "active");
  const isSystemTemplate = scalarBoolean(
    query.isSystemTemplate,
    "isSystemTemplate"
  );

  if (campaignType) filter.campaignType = campaignType;
  if (channel) filter.channel = channel;
  if (createdBy) filter.createdBy = createdBy;
  if (tag) filter.tags = tag;
  if (active !== undefined) filter.active = active;
  if (isSystemTemplate !== undefined) {
    filter.isSystemTemplate = isSystemTemplate;
  }

  return filter;
}

export function buildCommunicationDeliveryFilter(query = {}) {
  const filter = {};
  const campaign = communicationObjectId(query.campaignId, "campaignId");
  const customer = communicationObjectId(query.customerId, "customerId");
  const channel = scalarString(query.channel, "channel", { lowercase: true });
  const status = scalarString(query.status, "status", { lowercase: true });
  const provider = scalarString(query.provider, "provider", { lowercase: true });
  const mode = scalarString(query.mode, "mode", { lowercase: true });
  const retryable = scalarBoolean(query.retryable, "retryable");

  if (campaign) filter.campaign = campaign;
  if (customer) filter.customer = customer;
  if (channel) filter.channel = channel;
  if (status) filter.status = status;
  if (provider) filter.provider = provider;
  if (mode) filter.mode = mode;
  if (retryable !== undefined) filter["retry.retryable"] = retryable;

  const createdFrom = scalarDate(query.createdFrom, "createdFrom");
  const createdTo = scalarDate(query.createdTo, "createdTo");
  if (createdFrom || createdTo) {
    filter.createdAt = {};
    if (createdFrom) filter.createdAt.$gte = createdFrom;
    if (createdTo) filter.createdAt.$lte = createdTo;
  }

  const search = scalarString(query.search, "search", {
    maxLength: MAX_SEARCH_LENGTH,
  });
  if (search) {
    const email = search.toLowerCase();
    const phone = search.replace(/[\s\-().]/g, "");
    filter.$or = [
      { deliveryId: search },
      { providerMessageId: search },
      { "recipient.email": email },
      { "recipient.phone": phone },
      { "recipient.name": search },
    ];
  }

  return filter;
}

export default {
  buildCommunicationCampaignFilter,
  buildCommunicationDeliveryFilter,
  buildCommunicationTemplateFilter,
  communicationObjectId,
};
