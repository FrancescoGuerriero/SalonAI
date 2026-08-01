import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import CommunicationCampaign, {
  AUDIENCE_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  COMMUNICATION_CHANNELS,
  CUSTOMER_SEGMENTS,
  SEND_MODES,
  extractCampaignVariables,
} from "../models/CommunicationCampaign.js";

import CommunicationCampaignRecipient, {
  RECIPIENT_STATUSES,
} from "../models/CommunicationCampaignRecipient.js";

import CommunicationTemplate from "../models/CommunicationTemplate.js";
import Customer from "../models/customer.js";
import CustomerContactLog from "../models/customerContactLog.js";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;
const MAX_AUDIENCE_SIZE = 50000;
const DEFAULT_PREVIEW_SIZE = 10;

const EDITABLE_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "paused",
  "failed",
];

const TERMINAL_RECIPIENT_STATUSES = [
  "responded",
  "failed",
  "skipped",
  "cancelled",
];

const CAMPAIGN_SORT_OPTIONS = {
  newest: {
    createdAt: -1,
    _id: -1,
  },

  oldest: {
    createdAt: 1,
    _id: 1,
  },

  name_asc: {
    name: 1,
    _id: 1,
  },

  name_desc: {
    name: -1,
    _id: -1,
  },

  recently_updated: {
    updatedAt: -1,
    _id: -1,
  },

  scheduled_first: {
    "schedule.scheduledAt": 1,
    createdAt: -1,
  },

  most_recipients: {
    "deliveryCounts.totalRecipients": -1,
    createdAt: -1,
  },
};

const CAMPAIGN_EDITABLE_FIELDS = [
  "name",
  "description",
  "campaignType",
  "channel",
  "template",
  "subject",
  "body",
  "variables",
  "variableValues",
  "audience",
  "schedule",
  "options",
  "metadata",
];

const SAFE_CUSTOM_FILTER_FIELDS = [
  "active",
  "status",
  "gender",
  "city",
  "postcode",
  "source",
  "preferredContactChannel",
  "isVip",
];

function createServiceError(
  message,
  statusCode = 400,
  code = "COMMUNICATION_CAMPAIGN_ERROR"
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value, fieldName = "ID") {
  if (!value || !isValidObjectId(value)) {
    throw createServiceError(
      `${fieldName} must be a valid MongoDB ID.`,
      400,
      "INVALID_OBJECT_ID"
    );
  }

  return new mongoose.Types.ObjectId(value);
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsedValue = Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function normalizeNonNegativeNumber(
  value,
  fallback = 0
) {
  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return fallback;
  }

  return parsedValue;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value
      .trim()
      .toLowerCase();

    if (
      normalizedValue === "true" ||
      normalizedValue === "1"
    ) {
      return true;
    }

    if (
      normalizedValue === "false" ||
      normalizedValue === "0"
    ) {
      return false;
    }
  }

  return undefined;
}

function normalizeDate(
  value,
  {
    endOfDay = false,
    required = false,
    fieldName = "date",
  } = {}
) {
  if (!value) {
    if (required) {
      throw createServiceError(
        `${fieldName} is required.`,
        400,
        "DATE_REQUIRED"
      );
    }

    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      `${fieldName} must be a valid date.`,
      400,
      "INVALID_DATE"
    );
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(normalizeText)
        .filter(Boolean)
    )
  );
}

function normalizeObjectIdArray(
  value,
  fieldName
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = [];

  for (const candidate of value) {
    const resolvedCandidate =
      candidate?._id || candidate?.id || candidate;

    if (!isValidObjectId(resolvedCandidate)) {
      throw createServiceError(
        `${fieldName} contains an invalid MongoDB ID.`,
        400,
        "INVALID_OBJECT_ID_ARRAY"
      );
    }

    ids.push(String(resolvedCandidate));
  }

  return Array.from(new Set(ids)).map(
    (id) => new mongoose.Types.ObjectId(id)
  );
}

function normalizePlainObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}

function validateEnumValue(
  value,
  allowedValues,
  fieldName
) {
  if (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    !allowedValues.includes(value)
  ) {
    throw createServiceError(
      `${fieldName} must be one of: ${allowedValues.join(
        ", "
      )}.`,
      400,
      "INVALID_ENUM_VALUE"
    );
  }
}

function getUserId(user) {
  const candidate =
    user?._id ||
    user?.id ||
    user;

  if (!candidate || !isValidObjectId(candidate)) {
    return null;
  }

  return candidate;
}

function escapeRegularExpression(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function getCampaignId(campaign) {
  return campaign?._id || campaign?.id || campaign;
}

function getCustomerName(customer) {
  return (
    normalizeText(customer?.fullName) ||
    normalizeText(customer?.name) ||
    [
      normalizeText(customer?.firstName),
      normalizeText(customer?.lastName),
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer"
  );
}

function getCustomerEmail(customer) {
  return normalizeText(customer?.email).toLowerCase();
}

function getCustomerPhone(customer) {
  return normalizeText(
    customer?.phone ||
      customer?.phoneNumber ||
      customer?.mobile ||
      customer?.telephone
  ).replace(/[^\d+]/g, "");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeText(value)
  );
}

function isValidPhone(value) {
  return /^\+?[0-9]{7,15}$/.test(
    normalizeText(value)
  );
}

function getCustomerRecipient(
  customer,
  channel
) {
  switch (channel) {
    case "email":
      return getCustomerEmail(customer);

    case "sms":
    case "whatsapp":
    case "phone":
      return getCustomerPhone(customer);

    case "in_app":
      return String(customer?._id || "");

    default:
      return "";
  }
}

function getMissingContactReason(
  customer,
  channel
) {
  const recipient = getCustomerRecipient(
    customer,
    channel
  );

  if (!recipient) {
    return {
      reason: "missing_contact",
      details:
        channel === "email"
          ? "Customer does not have an email address."
          : channel === "in_app"
            ? "Customer does not have a valid application account."
            : "Customer does not have a phone number.",
    };
  }

  if (
    channel === "email" &&
    !isValidEmail(recipient)
  ) {
    return {
      reason: "invalid_contact",
      details:
        "Customer email address is invalid.",
    };
  }

  if (
    ["sms", "whatsapp", "phone"].includes(
      channel
    ) &&
    !isValidPhone(recipient)
  ) {
    return {
      reason: "invalid_contact",
      details:
        "Customer phone number is invalid.",
    };
  }

  return null;
}

function isExplicitlyUnsubscribed(
  customer,
  channel
) {
  const preferences =
    customer?.communicationPreferences ||
    customer?.contactPreferences ||
    customer?.marketingPreferences ||
    {};

  if (
    customer?.unsubscribed === true ||
    customer?.marketingUnsubscribed === true ||
    customer?.doNotContact === true
  ) {
    return true;
  }

  if (
    preferences?.all === false ||
    preferences?.marketing === false ||
    preferences?.[channel] === false
  ) {
    return true;
  }

  const channelUnsubscribeField =
    `${channel}Unsubscribed`;

  return customer?.[channelUnsubscribeField] === true;
}

function hasExplicitConsentFailure(
  customer,
  channel
) {
  const consent =
    customer?.consent ||
    customer?.consents ||
    customer?.communicationConsent ||
    {};

  if (
    customer?.marketingConsent === false ||
    consent?.marketing === false ||
    consent?.communications === false ||
    consent?.[channel] === false
  ) {
    return true;
  }

  return false;
}

function isInactiveCustomer(customer) {
  return (
    customer?.active === false ||
    customer?.isActive === false ||
    ["inactive", "disabled", "archived"].includes(
      normalizeText(customer?.status).toLowerCase()
    )
  );
}

function formatDateForTemplate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTimeForTemplate(value) {
  if (!value) {
    return "";
  }

  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}/.test(value)
  ) {
    return value.slice(0, 5);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getAppointmentDate(appointment) {
  return (
    appointment?.appointmentDate ||
    appointment?.startTime ||
    appointment?.date ||
    appointment?.scheduledAt ||
    null
  );
}

function getAppointmentTime(appointment) {
  return (
    appointment?.appointmentTime ||
    appointment?.startTime ||
    appointment?.time ||
    ""
  );
}

function getAppointmentServiceName(
  appointment
) {
  const service = appointment?.service;

  if (!service) {
    return "";
  }

  if (typeof service === "string") {
    return "";
  }

  return (
    normalizeText(service?.name) ||
    normalizeText(service?.title)
  );
}

function getAppointmentStylistName(
  appointment
) {
  const stylist = appointment?.stylist;

  if (!stylist || typeof stylist === "string") {
    return "";
  }

  return (
    normalizeText(stylist?.name) ||
    [
      normalizeText(stylist?.firstName),
      normalizeText(stylist?.lastName),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function buildCustomerVariables(
  customer,
  appointment,
  campaign
) {
  const customerName = getCustomerName(customer);

  return {
    customerName,
    firstName:
      normalizeText(customer?.firstName) ||
      customerName.split(" ")[0] ||
      "",
    lastName:
      normalizeText(customer?.lastName) ||
      customerName.split(" ").slice(1).join(" "),
    customerEmail: getCustomerEmail(customer),
    customerPhone: getCustomerPhone(customer),

    salonName:
      normalizeText(
        campaign?.variableValues?.salonName
      ) ||
      normalizeText(process.env.SALON_NAME) ||
      "SalonAI",

    salonPhone:
      normalizeText(
        campaign?.variableValues?.salonPhone
      ) ||
      normalizeText(process.env.SALON_PHONE),

    salonEmail:
      normalizeText(
        campaign?.variableValues?.salonEmail
      ) ||
      normalizeText(process.env.SALON_EMAIL),

    appointmentDate: formatDateForTemplate(
      getAppointmentDate(appointment)
    ),

    appointmentTime: formatTimeForTemplate(
      getAppointmentTime(appointment)
    ),

    stylistName:
      getAppointmentStylistName(appointment),

    serviceName:
      getAppointmentServiceName(appointment),

    bookingReference:
      normalizeText(
        appointment?.bookingReference ||
          appointment?.reference
      ),

    campaignName: normalizeText(campaign?.name),

    rebookingLink:
      normalizeText(
        campaign?.variableValues?.rebookingLink
      ) ||
      normalizeText(process.env.BOOKING_URL),

    ...normalizePlainObject(
      campaign?.variableValues
    ),
  };
}

function renderTemplateText(
  value,
  variables
) {
  return normalizeText(value).replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (placeholder, variableName) => {
      const replacement =
        variables?.[variableName];

      if (
        replacement === undefined ||
        replacement === null ||
        replacement === ""
      ) {
        return placeholder;
      }

      return String(replacement);
    }
  );
}

function findMissingTemplateVariables(
  variables,
  subject,
  body
) {
  const requiredVariables =
    extractCampaignVariables(subject, body);

  return requiredVariables.filter(
    (variableName) =>
      variables?.[variableName] === undefined ||
      variables?.[variableName] === null ||
      variables?.[variableName] === ""
  );
}

function buildCreatedAtFilter(filters = {}) {
  const dateFilter = {};

  if (filters.startDate) {
    dateFilter.$gte = normalizeDate(
      filters.startDate,
      {
        fieldName: "startDate",
      }
    );
  }

  if (filters.endDate) {
    dateFilter.$lte = normalizeDate(
      filters.endDate,
      {
        endOfDay: true,
        fieldName: "endDate",
      }
    );
  }

  return Object.keys(dateFilter).length > 0
    ? dateFilter
    : null;
}

function buildCampaignMatch(filters = {}) {
  const match = {};

  const search = normalizeText(filters.search);

  if (search) {
    const expression = new RegExp(
      escapeRegularExpression(search),
      "i"
    );

    match.$or = [
      {
        name: expression,
      },
      {
        description: expression,
      },
      {
        subject: expression,
      },
      {
        body: expression,
      },
    ];
  }

  if (filters.status) {
    validateEnumValue(
      filters.status,
      CAMPAIGN_STATUSES,
      "status"
    );

    match.status = filters.status;
  }

  if (filters.campaignType) {
    validateEnumValue(
      filters.campaignType,
      CAMPAIGN_TYPES,
      "campaignType"
    );

    match.campaignType =
      filters.campaignType;
  }

  if (filters.channel) {
    validateEnumValue(
      filters.channel,
      COMMUNICATION_CHANNELS,
      "channel"
    );

    match.channel = filters.channel;
  }

  if (filters.sendMode) {
    validateEnumValue(
      filters.sendMode,
      SEND_MODES,
      "sendMode"
    );

    match["schedule.mode"] =
      filters.sendMode;
  }

  if (filters.createdBy) {
    match.createdBy = toObjectId(
      filters.createdBy,
      "createdBy"
    );
  }

  const createdAt =
    buildCreatedAtFilter(filters);

  if (createdAt) {
    match.createdAt = createdAt;
  }

  return match;
}

function getCampaignSort(sort) {
  const normalizedSort =
    normalizeText(sort) ||
    "recently_updated";

  return (
    CAMPAIGN_SORT_OPTIONS[normalizedSort] ||
    CAMPAIGN_SORT_OPTIONS.recently_updated
  );
}

function sanitizeCustomQuery(customQuery) {
  const source =
    normalizePlainObject(customQuery);

  const sanitized = {};

  for (const field of SAFE_CUSTOM_FILTER_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(
        source,
        field
      )
    ) {
      sanitized[field] = source[field];
    }
  }

  return sanitized;
}

function prepareAudience(
  audience = {}
) {
  const type =
    audience.type || "selected_customers";

  validateEnumValue(
    type,
    AUDIENCE_TYPES,
    "audience.type"
  );

  const segments = normalizeStringArray(
    audience.segments
  );

  for (const segment of segments) {
    validateEnumValue(
      segment,
      CUSTOMER_SEGMENTS,
      "audience.segments"
    );
  }

  return {
    type,
    segments,

    customerIds: normalizeObjectIdArray(
      audience.customerIds,
      "audience.customerIds"
    ),

    excludedCustomerIds:
      normalizeObjectIdArray(
        audience.excludedCustomerIds,
        "audience.excludedCustomerIds"
      ),

    filters: {
      dormantDays:
        audience.filters?.dormantDays
          ? normalizePositiveInteger(
              audience.filters.dormantDays,
              60,
              3650
            )
          : null,

      minimumSpend:
        audience.filters?.minimumSpend !==
        undefined
          ? normalizeNonNegativeNumber(
              audience.filters.minimumSpend
            )
          : null,

      maximumSpend:
        audience.filters?.maximumSpend !==
        undefined
          ? normalizeNonNegativeNumber(
              audience.filters.maximumSpend
            )
          : null,

      minimumAppointments:
        audience.filters
          ?.minimumAppointments !== undefined
          ? normalizeNonNegativeNumber(
              audience.filters
                .minimumAppointments
            )
          : null,

      maximumAppointments:
        audience.filters
          ?.maximumAppointments !== undefined
          ? normalizeNonNegativeNumber(
              audience.filters
                .maximumAppointments
            )
          : null,

      lastAppointmentBefore:
        normalizeDate(
          audience.filters
            ?.lastAppointmentBefore,
          {
            endOfDay: true,
            fieldName:
              "audience.filters.lastAppointmentBefore",
          }
        ),

      lastAppointmentAfter:
        normalizeDate(
          audience.filters
            ?.lastAppointmentAfter,
          {
            fieldName:
              "audience.filters.lastAppointmentAfter",
          }
        ),

      appointmentDateFrom:
        normalizeDate(
          audience.filters
            ?.appointmentDateFrom,
          {
            fieldName:
              "audience.filters.appointmentDateFrom",
          }
        ),

      appointmentDateTo:
        normalizeDate(
          audience.filters?.appointmentDateTo,
          {
            endOfDay: true,
            fieldName:
              "audience.filters.appointmentDateTo",
          }
        ),

      preferredStylist:
        audience.filters?.preferredStylist
          ? toObjectId(
              audience.filters
                .preferredStylist,
              "audience.filters.preferredStylist"
            )
          : null,

      preferredService:
        audience.filters?.preferredService
          ? toObjectId(
              audience.filters
                .preferredService,
              "audience.filters.preferredService"
            )
          : null,

      tags: normalizeStringArray(
        audience.filters?.tags
      ).map((tag) => tag.toLowerCase()),

      excludeTags: normalizeStringArray(
        audience.filters?.excludeTags
      ).map((tag) => tag.toLowerCase()),

      hasEmail: normalizeBoolean(
        audience.filters?.hasEmail
      ),

      hasPhone: normalizeBoolean(
        audience.filters?.hasPhone
      ),

      birthdayMonth:
        audience.filters?.birthdayMonth
          ? normalizePositiveInteger(
              audience.filters.birthdayMonth,
              1,
              12
            )
          : null,

      customQuery: sanitizeCustomQuery(
        audience.filters?.customQuery
      ),
    },

    estimatedRecipients:
      normalizeNonNegativeNumber(
        audience.estimatedRecipients
      ),

    calculatedAt:
      audience.calculatedAt
        ? normalizeDate(
            audience.calculatedAt,
            {
              fieldName:
                "audience.calculatedAt",
            }
          )
        : null,
  };
}

function prepareSchedule(schedule = {}) {
  const mode = schedule.mode || "draft";

  validateEnumValue(
    mode,
    SEND_MODES,
    "schedule.mode"
  );

  const scheduledAt =
    mode === "scheduled"
      ? normalizeDate(
          schedule.scheduledAt,
          {
            required: true,
            fieldName:
              "schedule.scheduledAt",
          }
        )
      : null;

  if (
    scheduledAt &&
    scheduledAt.getTime() <= Date.now()
  ) {
    throw createServiceError(
      "Scheduled campaigns must use a future date and time.",
      400,
      "CAMPAIGN_SCHEDULE_IN_PAST"
    );
  }

  return {
    mode,
    scheduledAt,

    timezone:
      normalizeText(schedule.timezone) ||
      "Europe/London",

    batchSize: normalizePositiveInteger(
      schedule.batchSize,
      100,
      1000
    ),

    delayBetweenBatchesSeconds:
      normalizeNonNegativeNumber(
        schedule.delayBetweenBatchesSeconds,
        0
      ),
  };
}

function prepareCampaignOptions(options = {}) {
  const defaults = {
    trackDelivery: true,
    trackOpens: true,
    trackResponses: true,
    requireContactConsent: true,
    excludeUnsubscribed: true,
    excludeInvalidContacts: true,
    preventDuplicateRecipients: true,
    createContactLogs: true,
    dryRun: false,
  };

  const prepared = {
    ...defaults,
  };

  for (const field of Object.keys(defaults)) {
    const value = normalizeBoolean(
      options[field]
    );

    if (value !== undefined) {
      prepared[field] = value;
    }
  }

  return prepared;
}

async function resolveTemplate(
  templateValue
) {
  if (!templateValue) {
    return null;
  }

  const templateId = toObjectId(
    templateValue?._id ||
      templateValue?.id ||
      templateValue,
    "template"
  );

  const template =
    await CommunicationTemplate.findById(
      templateId
    ).lean();

  if (!template) {
    throw createServiceError(
      "Communication template not found.",
      404,
      "COMMUNICATION_TEMPLATE_NOT_FOUND"
    );
  }

  return template;
}

async function prepareCampaignPayload(
  payload = {},
  {
    partial = false,
  } = {}
) {
  const prepared = {};

  for (const field of CAMPAIGN_EDITABLE_FIELDS) {
    const hasField =
      Object.prototype.hasOwnProperty.call(
        payload,
        field
      );

    if (!hasField && partial) {
      continue;
    }

    if (!hasField) {
      continue;
    }

    switch (field) {
      case "name":
      case "description":
      case "subject":
      case "body":
        prepared[field] =
          normalizeText(payload[field]);
        break;

      case "campaignType":
        validateEnumValue(
          payload[field],
          CAMPAIGN_TYPES,
          "campaignType"
        );

        prepared[field] = payload[field];
        break;

      case "channel":
        validateEnumValue(
          payload[field],
          COMMUNICATION_CHANNELS,
          "channel"
        );

        prepared[field] = payload[field];
        break;

      case "template":
        prepared.template =
          payload.template
            ? toObjectId(
                payload.template?._id ||
                  payload.template?.id ||
                  payload.template,
                "template"
              )
            : null;
        break;

      case "variables":
        prepared.variables =
          normalizeStringArray(
            payload.variables
          );
        break;

      case "variableValues":
        prepared.variableValues =
          normalizePlainObject(
            payload.variableValues
          );
        break;

      case "audience":
        prepared.audience =
          prepareAudience(payload.audience);
        break;

      case "schedule":
        prepared.schedule =
          prepareSchedule(payload.schedule);
        break;

      case "options":
        prepared.options =
          prepareCampaignOptions(
            payload.options
          );
        break;

      case "metadata":
        prepared.metadata =
          normalizePlainObject(
            payload.metadata
          );
        break;

      default:
        break;
    }
  }

  if (prepared.template) {
    const template = await resolveTemplate(
      prepared.template
    );

    if (!prepared.channel) {
      prepared.channel = template.channel;
    }

    if (!prepared.campaignType) {
      prepared.campaignType =
        template.campaignType;
    }

    if (
      prepared.subject === undefined ||
      prepared.subject === ""
    ) {
      prepared.subject =
        template.subject || "";
    }

    if (
      prepared.body === undefined ||
      prepared.body === ""
    ) {
      prepared.body = template.body || "";
    }

    prepared.variables = Array.from(
      new Set([
        ...(prepared.variables || []),
        ...(template.variables || []),
      ])
    ).sort();
  }

  return prepared;
}

function validateCampaignPayload(payload) {
  if (!normalizeText(payload.name)) {
    throw createServiceError(
      "Campaign name is required.",
      400,
      "CAMPAIGN_NAME_REQUIRED"
    );
  }

  if (!normalizeText(payload.channel)) {
    throw createServiceError(
      "Communication channel is required.",
      400,
      "CAMPAIGN_CHANNEL_REQUIRED"
    );
  }

  if (!normalizeText(payload.body)) {
    throw createServiceError(
      "Campaign message body is required.",
      400,
      "CAMPAIGN_BODY_REQUIRED"
    );
  }

  if (
    payload.channel === "email" &&
    !normalizeText(payload.subject)
  ) {
    throw createServiceError(
      "Email campaigns require a subject.",
      400,
      "CAMPAIGN_SUBJECT_REQUIRED"
    );
  }

  if (!payload.audience) {
    throw createServiceError(
      "Campaign audience configuration is required.",
      400,
      "CAMPAIGN_AUDIENCE_REQUIRED"
    );
  }
}

function handleDatabaseError(
  error,
  fallbackMessage
) {
  if (error?.code === 11000) {
    throw createServiceError(
      "A campaign with the same unique details already exists.",
      409,
      "DUPLICATE_CAMPAIGN"
    );
  }

  if (error?.name === "ValidationError") {
    const messages = Object.values(
      error.errors || {}
    )
      .map(
        (validationError) =>
          validationError.message
      )
      .filter(Boolean);

    throw createServiceError(
      messages.join(" ") || fallbackMessage,
      400,
      "CAMPAIGN_VALIDATION_ERROR"
    );
  }

  throw error;
}

async function findCampaignDocument(
  campaignId
) {
  const id = toObjectId(
    campaignId,
    "campaignId"
  );

  const campaign =
    await CommunicationCampaign.findById(id);

  if (!campaign) {
    throw createServiceError(
      "Communication campaign not found.",
      404,
      "COMMUNICATION_CAMPAIGN_NOT_FOUND"
    );
  }

  return campaign;
}

function assertCampaignEditable(campaign) {
  if (
    !EDITABLE_CAMPAIGN_STATUSES.includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      `Campaigns with status “${campaign.status}” cannot be edited.`,
      409,
      "CAMPAIGN_NOT_EDITABLE"
    );
  }
}

async function getAppointmentCustomerIds(
  appointmentMatch
) {
  const appointments =
    await Appointment.find(
      appointmentMatch
    )
      .select("customer")
      .lean();

  return appointments
    .map((appointment) =>
      String(appointment.customer || "")
    )
    .filter(isValidObjectId);
}

async function getReturningCustomerIds() {
  const results = await Appointment.aggregate([
    {
      $match: {
        customer: {
          $ne: null,
        },
      },
    },
    {
      $group: {
        _id: "$customer",
        appointmentCount: {
          $sum: 1,
        },
      },
    },
    {
      $match: {
        appointmentCount: {
          $gte: 2,
        },
      },
    },
    {
      $limit: MAX_AUDIENCE_SIZE,
    },
  ]);

  return results.map((result) =>
    String(result._id)
  );
}

async function getDormantCustomerIds(
  dormantDays
) {
  const threshold = new Date();

  threshold.setHours(23, 59, 59, 999);
  threshold.setDate(
    threshold.getDate() - dormantDays
  );

  const results = await Appointment.aggregate([
    {
      $match: {
        customer: {
          $ne: null,
        },
      },
    },
    {
      $project: {
        customer: 1,

        appointmentDate: {
          $ifNull: [
            "$appointmentDate",
            {
              $ifNull: [
                "$startTime",
                {
                  $ifNull: [
                    "$date",
                    "$scheduledAt",
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$customer",

        lastAppointmentAt: {
          $max: "$appointmentDate",
        },
      },
    },
    {
      $match: {
        lastAppointmentAt: {
          $lte: threshold,
        },
      },
    },
    {
      $limit: MAX_AUDIENCE_SIZE,
    },
  ]);

  return results.map((result) =>
    String(result._id)
  );
}

async function resolveSegmentCustomerIds(
  segment,
  audienceFilters
) {
  const now = new Date();

  switch (segment) {
    case "new_customers": {
      const threshold = new Date();

      threshold.setDate(
        threshold.getDate() - 90
      );

      const customers = await Customer.find({
        createdAt: {
          $gte: threshold,
        },
      })
        .select("_id")
        .limit(MAX_AUDIENCE_SIZE)
        .lean();

      return customers.map((customer) =>
        String(customer._id)
      );
    }

    case "returning_customers":
      return getReturningCustomerIds();

    case "dormant_customers":
      return getDormantCustomerIds(
        audienceFilters.dormantDays || 60
      );

    case "high_value_customers": {
      const minimumSpend =
        audienceFilters.minimumSpend ?? 500;

      const customers = await Customer.find({
        $or: [
          {
            totalSpend: {
              $gte: minimumSpend,
            },
          },
          {
            lifetimeValue: {
              $gte: minimumSpend,
            },
          },
          {
            totalSpent: {
              $gte: minimumSpend,
            },
          },
        ],
      })
        .select("_id")
        .limit(MAX_AUDIENCE_SIZE)
        .lean();

      return customers.map((customer) =>
        String(customer._id)
      );
    }

    case "upcoming_appointments":
      return getAppointmentCustomerIds({
        status: {
          $nin: [
            "cancelled",
            "completed",
            "no_show",
          ],
        },

        $or: [
          {
            appointmentDate: {
              $gte: now,
            },
          },
          {
            startTime: {
              $gte: now,
            },
          },
          {
            date: {
              $gte: now,
            },
          },
          {
            scheduledAt: {
              $gte: now,
            },
          },
        ],
      });

    case "birthday_customers": {
      const birthdayMonth =
        audienceFilters.birthdayMonth ||
        now.getMonth() + 1;

      const customers = await Customer.find({
        $or: [
          {
            $expr: {
              $eq: [
                {
                  $month: "$dateOfBirth",
                },
                birthdayMonth,
              ],
            },
          },
          {
            $expr: {
              $eq: [
                {
                  $month: "$birthday",
                },
                birthdayMonth,
              ],
            },
          },
        ],
      })
        .select("_id")
        .limit(MAX_AUDIENCE_SIZE)
        .lean();

      return customers.map((customer) =>
        String(customer._id)
      );
    }

    case "inactive_customers": {
      const customers = await Customer.find({
        $or: [
          {
            active: false,
          },
          {
            isActive: false,
          },
          {
            status: {
              $in: [
                "inactive",
                "disabled",
                "archived",
              ],
            },
          },
        ],
      })
        .select("_id")
        .limit(MAX_AUDIENCE_SIZE)
        .lean();

      return customers.map((customer) =>
        String(customer._id)
      );
    }

    case "vip_customers": {
      const customers = await Customer.find({
        $or: [
          {
            isVip: true,
          },
          {
            tags: {
              $in: ["vip", "VIP"],
            },
          },
        ],
      })
        .select("_id")
        .limit(MAX_AUDIENCE_SIZE)
        .lean();

      return customers.map((customer) =>
        String(customer._id)
      );
    }

    case "custom":
      return [];

    default:
      return [];
  }
}

function buildCustomerFilterMatch(filters) {
  const andConditions = [];

  if (filters.minimumSpend !== null) {
    andConditions.push({
      $or: [
        {
          totalSpend: {
            $gte: filters.minimumSpend,
          },
        },
        {
          lifetimeValue: {
            $gte: filters.minimumSpend,
          },
        },
        {
          totalSpent: {
            $gte: filters.minimumSpend,
          },
        },
      ],
    });
  }

  if (filters.maximumSpend !== null) {
    andConditions.push({
      $or: [
        {
          totalSpend: {
            $lte: filters.maximumSpend,
          },
        },
        {
          lifetimeValue: {
            $lte: filters.maximumSpend,
          },
        },
        {
          totalSpent: {
            $lte: filters.maximumSpend,
          },
        },
      ],
    });
  }

  if (filters.minimumAppointments !== null) {
    andConditions.push({
      $or: [
        {
          appointmentCount: {
            $gte: filters.minimumAppointments,
          },
        },
        {
          totalAppointments: {
            $gte: filters.minimumAppointments,
          },
        },
      ],
    });
  }

  if (filters.maximumAppointments !== null) {
    andConditions.push({
      $or: [
        {
          appointmentCount: {
            $lte: filters.maximumAppointments,
          },
        },
        {
          totalAppointments: {
            $lte: filters.maximumAppointments,
          },
        },
      ],
    });
  }

  if (
    filters.lastAppointmentBefore ||
    filters.lastAppointmentAfter
  ) {
    const dateFilter = {};

    if (filters.lastAppointmentBefore) {
      dateFilter.$lte =
        filters.lastAppointmentBefore;
    }

    if (filters.lastAppointmentAfter) {
      dateFilter.$gte =
        filters.lastAppointmentAfter;
    }

    andConditions.push({
      $or: [
        {
          lastAppointmentAt: dateFilter,
        },
        {
          lastVisitAt: dateFilter,
        },
        {
          lastAppointmentDate: dateFilter,
        },
      ],
    });
  }

  if (filters.tags.length > 0) {
    andConditions.push({
      tags: {
        $all: filters.tags,
      },
    });
  }

  if (filters.excludeTags.length > 0) {
    andConditions.push({
      tags: {
        $nin: filters.excludeTags,
      },
    });
  }

  if (filters.hasEmail === true) {
    andConditions.push({
      email: {
        $exists: true,
        $nin: ["", null],
      },
    });
  }

  if (filters.hasEmail === false) {
    andConditions.push({
      $or: [
        {
          email: {
            $exists: false,
          },
        },
        {
          email: "",
        },
        {
          email: null,
        },
      ],
    });
  }

  if (filters.hasPhone === true) {
    andConditions.push({
      $or: [
        {
          phone: {
            $exists: true,
            $nin: ["", null],
          },
        },
        {
          phoneNumber: {
            $exists: true,
            $nin: ["", null],
          },
        },
        {
          mobile: {
            $exists: true,
            $nin: ["", null],
          },
        },
      ],
    });
  }

  if (filters.hasPhone === false) {
    andConditions.push({
      $and: [
        {
          $or: [
            {
              phone: {
                $exists: false,
              },
            },
            {
              phone: "",
            },
            {
              phone: null,
            },
          ],
        },
        {
          $or: [
            {
              phoneNumber: {
                $exists: false,
              },
            },
            {
              phoneNumber: "",
            },
            {
              phoneNumber: null,
            },
          ],
        },
        {
          $or: [
            {
              mobile: {
                $exists: false,
              },
            },
            {
              mobile: "",
            },
            {
              mobile: null,
            },
          ],
        },
      ],
    });
  }

  if (filters.birthdayMonth) {
    andConditions.push({
      $or: [
        {
          $expr: {
            $eq: [
              {
                $month: "$dateOfBirth",
              },
              filters.birthdayMonth,
            ],
          },
        },
        {
          $expr: {
            $eq: [
              {
                $month: "$birthday",
              },
              filters.birthdayMonth,
            ],
          },
        },
      ],
    });
  }

  for (const [field, value] of Object.entries(
    filters.customQuery
  )) {
    andConditions.push({
      [field]: value,
    });
  }

  return andConditions.length > 0
    ? {
        $and: andConditions,
      }
    : {};
}

async function resolveAudienceCustomers(
  audience
) {
  const excludedIds = new Set(
    audience.excludedCustomerIds.map((id) =>
      String(id)
    )
  );

  let customerIds = [];

  if (
    audience.type === "selected_customers"
  ) {
    customerIds = audience.customerIds.map(
      (id) => String(id)
    );
  }

  if (audience.type === "segments") {
    const segmentResults = await Promise.all(
      audience.segments.map((segment) =>
        resolveSegmentCustomerIds(
          segment,
          audience.filters
        )
      )
    );

    customerIds = segmentResults.flat();
  }

  let customerMatch = {};

  if (
    audience.type === "all_customers" ||
    audience.type === "custom_filters"
  ) {
    customerMatch = buildCustomerFilterMatch(
      audience.filters
    );
  } else {
    const uniqueCustomerIds = Array.from(
      new Set(customerIds)
    )
      .filter(isValidObjectId)
      .filter(
        (customerId) =>
          !excludedIds.has(customerId)
      )
      .map(
        (customerId) =>
          new mongoose.Types.ObjectId(
            customerId
          )
      );

    customerMatch = {
      _id: {
        $in: uniqueCustomerIds,
      },
    };
  }

  if (audience.excludedCustomerIds.length > 0) {
    customerMatch = {
      $and: [
        customerMatch,
        {
          _id: {
            $nin:
              audience.excludedCustomerIds,
          },
        },
      ],
    };
  }

  const customers = await Customer.find(
    customerMatch
  )
    .limit(MAX_AUDIENCE_SIZE)
    .lean();

  return customers;
}

async function loadRelevantAppointments(
  customerIds
) {
  if (customerIds.length === 0) {
    return new Map();
  }

  const now = new Date();

  const appointments = await Appointment.find({
    customer: {
      $in: customerIds,
    },

    status: {
      $nin: ["cancelled"],
    },

    $or: [
      {
        appointmentDate: {
          $gte: now,
        },
      },
      {
        startTime: {
          $gte: now,
        },
      },
      {
        date: {
          $gte: now,
        },
      },
      {
        scheduledAt: {
          $gte: now,
        },
      },
    ],
  })
    .populate(
      "service",
      "name title"
    )
    .populate(
      "stylist",
      "name firstName lastName"
    )
    .sort({
      appointmentDate: 1,
      startTime: 1,
      createdAt: 1,
    })
    .lean();

  const appointmentMap = new Map();

  for (const appointment of appointments) {
    const customerId = String(
      appointment.customer
    );

    if (!appointmentMap.has(customerId)) {
      appointmentMap.set(
        customerId,
        appointment
      );
    }
  }

  return appointmentMap;
}

function evaluateCustomerEligibility(
  customer,
  campaign
) {
  const channel = campaign.channel;
  const options = campaign.options || {};

  if (
    options.excludeUnsubscribed &&
    isExplicitlyUnsubscribed(
      customer,
      channel
    )
  ) {
    return {
      eligible: false,
      reason: "unsubscribed",
      details:
        "Customer has unsubscribed from this communication channel.",
    };
  }

  if (
    options.requireContactConsent &&
    hasExplicitConsentFailure(
      customer,
      channel
    )
  ) {
    return {
      eligible: false,
      reason: "consent_missing",
      details:
        "Customer has not provided communication consent.",
    };
  }

  const contactIssue =
    getMissingContactReason(
      customer,
      channel
    );

  if (
    contactIssue &&
    options.excludeInvalidContacts
  ) {
    return {
      eligible: false,
      ...contactIssue,
    };
  }

  return {
    eligible: true,
    reason: "",
    details: "",
  };
}

async function createRecipientPayloads(
  campaign,
  customers,
  appointmentMap
) {
  return customers.map((customer) => {
    const customerId = String(customer._id);

    const appointment =
      appointmentMap.get(customerId) || null;

    const eligibility =
      evaluateCustomerEligibility(
        customer,
        campaign
      );

    const variables = buildCustomerVariables(
      customer,
      appointment,
      campaign
    );

    const missingVariables =
      findMissingTemplateVariables(
        variables,
        campaign.subject,
        campaign.body
      );

    let status = "pending";
    let skipReason = "";
    let skipDetails = "";

    if (!eligibility.eligible) {
      status = "skipped";
      skipReason = eligibility.reason;
      skipDetails = eligibility.details;
    }

    if (
      status === "pending" &&
      missingVariables.length > 0 &&
      campaign.options
        ?.excludeInvalidContacts
    ) {
      status = "skipped";
      skipReason = "audience_mismatch";
      skipDetails = `Missing template variables: ${missingVariables.join(
        ", "
      )}.`;
    }

    return {
      campaign: campaign._id,
      customer: customer._id,

      appointment:
        appointment?._id || null,

      template:
        campaign.template || null,

      channel: campaign.channel,

      recipient: getCustomerRecipient(
        customer,
        campaign.channel
      ),

      customerName:
        getCustomerName(customer),

      subject:
        campaign.channel === "email"
          ? renderTemplateText(
              campaign.subject,
              variables
            )
          : "",

      body: renderTemplateText(
        campaign.body,
        variables
      ),

      variables,

      status,
      skipReason,
      skipDetails,

      consentVerified:
        !hasExplicitConsentFailure(
          customer,
          campaign.channel
        ),

      consentVerifiedAt:
        !hasExplicitConsentFailure(
          customer,
          campaign.channel
        )
          ? new Date()
          : null,

      tracking: {
        deliveryTrackingEnabled:
          campaign.options?.trackDelivery !==
          false,

        openTrackingEnabled:
          campaign.options?.trackOpens !==
          false,

        responseTrackingEnabled:
          campaign.options?.trackResponses !==
          false,
      },

      metadata: {
        campaignType:
          campaign.campaignType,

        generatedAt:
          new Date().toISOString(),

        missingVariables,
      },
    };
  });
}

async function createContactLogsForRecipients(
  campaign,
  user
) {
  if (
    campaign.options?.createContactLogs ===
    false
  ) {
    return;
  }

  const recipients =
    await CommunicationCampaignRecipient.find({
      campaign: campaign._id,

      status: {
        $in: ["pending", "queued"],
      },

      contactLog: null,
    }).lean();

  if (recipients.length === 0) {
    return;
  }

  const userId = getUserId(user);

  const contactLogPayloads = recipients.map(
    (recipient) => ({
      customer: recipient.customer,
      appointment:
        recipient.appointment || undefined,

      campaignType:
        campaign.campaignType,

      channel: campaign.channel,

      direction: "outbound",

      subject: recipient.subject,
      message: recipient.body,

      status: "queued",
      recipient: recipient.recipient,

      createdBy: userId,

      metadata: {
        campaignId: campaign._id,
        campaignRecipientId:
          recipient._id,
        campaignName:
          campaign.name,
      },
    })
  );

  const contactLogs =
    await CustomerContactLog.insertMany(
      contactLogPayloads,
      {
        ordered: false,
      }
    );

  const operations = contactLogs.map(
    (contactLog, index) => ({
      updateOne: {
        filter: {
          _id: recipients[index]._id,
        },

        update: {
          $set: {
            contactLog: contactLog._id,
          },
        },
      },
    })
  );

  if (operations.length > 0) {
    await CommunicationCampaignRecipient.bulkWrite(
      operations
    );
  }
}

export async function createCommunicationCampaign(
  payload = {},
  user
) {
  const preparedPayload =
    await prepareCampaignPayload(payload);

  preparedPayload.campaignType =
    preparedPayload.campaignType ||
    "general";

  preparedPayload.schedule =
    preparedPayload.schedule ||
    prepareSchedule({
      mode: "draft",
    });

  preparedPayload.options =
    preparedPayload.options ||
    prepareCampaignOptions({});

  preparedPayload.audience =
    preparedPayload.audience ||
    prepareAudience({
      type: "selected_customers",
      customerIds: [],
    });

  preparedPayload.variables = Array.from(
    new Set([
      ...(preparedPayload.variables || []),
      ...extractCampaignVariables(
        preparedPayload.subject,
        preparedPayload.body
      ),
    ])
  ).sort();

  validateCampaignPayload(
    preparedPayload
  );

  const status =
    preparedPayload.schedule.mode ===
    "scheduled"
      ? "scheduled"
      : "draft";

  const userId = getUserId(user);

  try {
    const campaign =
      await CommunicationCampaign.create({
        ...preparedPayload,
        status,
        createdBy: userId,
        updatedBy: userId,
      });

    return getCommunicationCampaign(
      campaign._id
    );
  } catch (error) {
    handleDatabaseError(
      error,
      "Unable to create the communication campaign."
    );
  }
}

export async function listCommunicationCampaigns(
  filters = {}
) {
  const page = normalizePositiveInteger(
    filters.page,
    1,
    100000
  );

  const limit = normalizePositiveInteger(
    filters.limit,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  const skip = (page - 1) * limit;
  const match = buildCampaignMatch(filters);
  const sort = getCampaignSort(filters.sort);

  const [campaigns, total] =
    await Promise.all([
      CommunicationCampaign.find(match)
        .populate(
          "template",
          "name slug channel campaignType active"
        )
        .populate(
          "createdBy",
          "name firstName lastName email"
        )
        .populate(
          "updatedBy",
          "name firstName lastName email"
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({
          virtuals: true,
        }),

      CommunicationCampaign.countDocuments(
        match
      ),
    ]);

  return {
    campaigns,

    pagination: {
      page,
      limit,
      total,

      pages: Math.max(
        1,
        Math.ceil(total / limit)
      ),
    },
  };
}

export async function getCommunicationCampaign(
  campaignId
) {
  const id = toObjectId(
    campaignId,
    "campaignId"
  );

  const campaign =
    await CommunicationCampaign.findById(id)
      .populate(
        "template",
        "name slug description channel campaignType subject body variables active"
      )
      .populate(
        "audience.customerIds",
        "firstName lastName fullName name email phone phoneNumber mobile"
      )
      .populate(
        "audience.excludedCustomerIds",
        "firstName lastName fullName name email phone phoneNumber mobile"
      )
      .populate(
        "audience.filters.preferredStylist",
        "name firstName lastName"
      )
      .populate(
        "audience.filters.preferredService",
        "name title"
      )
      .populate(
        "createdBy",
        "name firstName lastName email"
      )
      .populate(
        "updatedBy",
        "name firstName lastName email"
      )
      .lean({
        virtuals: true,
      });

  if (!campaign) {
    throw createServiceError(
      "Communication campaign not found.",
      404,
      "COMMUNICATION_CAMPAIGN_NOT_FOUND"
    );
  }

  return campaign;
}

export async function updateCommunicationCampaign(
  campaignId,
  payload = {},
  user
) {
  const campaign =
    await findCampaignDocument(campaignId);

  assertCampaignEditable(campaign);

  const preparedPayload =
    await prepareCampaignPayload(payload, {
      partial: true,
    });

  for (const [field, value] of Object.entries(
    preparedPayload
  )) {
    campaign[field] = value;
  }

  campaign.variables = Array.from(
    new Set([
      ...(campaign.variables || []),
      ...extractCampaignVariables(
        campaign.subject,
        campaign.body
      ),
    ])
  ).sort();

  validateCampaignPayload({
    name: campaign.name,
    channel: campaign.channel,
    subject: campaign.subject,
    body: campaign.body,
    audience: campaign.audience,
  });

  if (
    campaign.schedule?.mode ===
    "scheduled"
  ) {
    campaign.status = "scheduled";
  } else if (
    campaign.status === "scheduled"
  ) {
    campaign.status = "draft";
  }

  const userId = getUserId(user);

  if (userId) {
    campaign.updatedBy = userId;
  }

  try {
    await campaign.save();

    return getCommunicationCampaign(
      campaign._id
    );
  } catch (error) {
    handleDatabaseError(
      error,
      "Unable to update the communication campaign."
    );
  }
}

export async function duplicateCommunicationCampaign(
  campaignId,
  payload = {},
  user
) {
  const source =
    await getCommunicationCampaign(
      campaignId
    );

  return createCommunicationCampaign(
    {
      name:
        normalizeText(payload.name) ||
        `${source.name} Copy`,

      description:
        payload.description !== undefined
          ? payload.description
          : source.description,

      campaignType:
        payload.campaignType ||
        source.campaignType,

      channel:
        payload.channel ||
        source.channel,

      template:
        payload.template !== undefined
          ? payload.template
          : source.template?._id ||
            source.template,

      subject:
        payload.subject !== undefined
          ? payload.subject
          : source.subject,

      body:
        payload.body !== undefined
          ? payload.body
          : source.body,

      variables: source.variables,

      variableValues: {
        ...(source.variableValues || {}),
        ...normalizePlainObject(
          payload.variableValues
        ),
      },

      audience:
        payload.audience || {
          ...source.audience,

          customerIds:
            source.audience?.customerIds?.map(
              (customer) =>
                customer?._id || customer
            ) || [],

          excludedCustomerIds:
            source.audience?.excludedCustomerIds?.map(
              (customer) =>
                customer?._id || customer
            ) || [],
        },

      schedule:
        payload.schedule || {
          ...source.schedule,
          mode: "draft",
          scheduledAt: null,
        },

      options: {
        ...(source.options || {}),
        ...normalizePlainObject(
          payload.options
        ),
      },

      metadata: {
        ...(source.metadata || {}),
        duplicatedFrom: source._id,
      },
    },
    user
  );
}

export async function deleteCommunicationCampaign(
  campaignId
) {
  const campaign =
    await findCampaignDocument(campaignId);

  if (
    !["draft", "failed", "cancelled"].includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      "Only draft, failed or cancelled campaigns can be deleted.",
      409,
      "CAMPAIGN_DELETE_FORBIDDEN"
    );
  }

  await CommunicationCampaignRecipient.deleteMany({
    campaign: campaign._id,
  });

  await campaign.deleteOne();

  return {
    message:
      "Communication campaign deleted successfully.",

    campaignId: String(campaign._id),
  };
}

export async function previewCampaignAudience(
  campaignOrPayload,
  options = {}
) {
  let campaign;

  if (
    typeof campaignOrPayload === "string" ||
    isValidObjectId(campaignOrPayload)
  ) {
    campaign =
      await findCampaignDocument(
        campaignOrPayload
      );
  } else {
    const preparedPayload =
      await prepareCampaignPayload(
        campaignOrPayload || {}
      );

    campaign = {
      _id: null,

      name:
        preparedPayload.name ||
        "Campaign Preview",

      campaignType:
        preparedPayload.campaignType ||
        "general",

      channel:
        preparedPayload.channel ||
        "email",

      subject:
        preparedPayload.subject || "",

      body:
        preparedPayload.body || "",

      variableValues:
        preparedPayload.variableValues ||
        {},

      audience:
        preparedPayload.audience ||
        prepareAudience({
          type: "all_customers",
        }),

      options:
        preparedPayload.options ||
        prepareCampaignOptions({}),
    };
  }

  const customers =
    await resolveAudienceCustomers(
      campaign.audience
    );

  const customerIds = customers.map(
    (customer) => customer._id
  );

  const appointmentMap =
    await loadRelevantAppointments(
      customerIds
    );

  const previewLimit =
    normalizePositiveInteger(
      options.limit,
      DEFAULT_PREVIEW_SIZE,
      50
    );

  const recipientPayloads =
    await createRecipientPayloads(
      campaign,
      customers,
      appointmentMap
    );

  const eligibleRecipients =
    recipientPayloads.filter(
      (recipient) =>
        recipient.status !== "skipped"
    );

  const skippedRecipients =
    recipientPayloads.filter(
      (recipient) =>
        recipient.status === "skipped"
    );

  const skipReasonCounts =
    skippedRecipients.reduce(
      (counts, recipient) => {
        const reason =
          recipient.skipReason || "other";

        counts[reason] =
          (counts[reason] || 0) + 1;

        return counts;
      },
      {}
    );

  return {
    estimatedRecipients:
      eligibleRecipients.length,

    totalMatchedCustomers:
      customers.length,

    skippedRecipients:
      skippedRecipients.length,

    skipReasonCounts,

    sample: recipientPayloads
      .slice(0, previewLimit)
      .map((recipient) => ({
        customerId: recipient.customer,
        customerName:
          recipient.customerName,
        recipient: recipient.recipient,
        subject: recipient.subject,
        body: recipient.body,
        status: recipient.status,
        skipReason:
          recipient.skipReason,
        skipDetails:
          recipient.skipDetails,
        missingVariables:
          recipient.metadata
            ?.missingVariables || [],
      })),
  };
}

export async function prepareCampaignRecipients(
  campaignId,
  options = {}
) {
  const campaign =
    await findCampaignDocument(campaignId);

  if (
    !EDITABLE_CAMPAIGN_STATUSES.includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      "Recipients can only be prepared for draft, scheduled, paused or failed campaigns.",
      409,
      "CAMPAIGN_RECIPIENT_PREPARATION_FORBIDDEN"
    );
  }

  const replaceExisting =
    options.replaceExisting !== false;

  const existingRecipientCount =
    await CommunicationCampaignRecipient.countDocuments(
      {
        campaign: campaign._id,
      }
    );

  if (
    existingRecipientCount > 0 &&
    !replaceExisting
  ) {
    throw createServiceError(
      "This campaign already has prepared recipients.",
      409,
      "CAMPAIGN_RECIPIENTS_ALREADY_PREPARED"
    );
  }

  const customers =
    await resolveAudienceCustomers(
      campaign.audience
    );

  if (customers.length === 0) {
    throw createServiceError(
      "No customers match the selected campaign audience.",
      409,
      "CAMPAIGN_AUDIENCE_EMPTY"
    );
  }

  const appointmentMap =
    await loadRelevantAppointments(
      customers.map(
        (customer) => customer._id
      )
    );

  const recipientPayloads =
    await createRecipientPayloads(
      campaign,
      customers,
      appointmentMap
    );

  if (replaceExisting) {
    await CommunicationCampaignRecipient.deleteMany({
      campaign: campaign._id,
    });
  }

  const operations = recipientPayloads.map(
    (recipientPayload) => ({
      updateOne: {
        filter: {
          campaign: campaign._id,
          customer:
            recipientPayload.customer,
        },

        update: {
          $set: recipientPayload,
        },

        upsert: true,
      },
    })
  );

  if (operations.length > 0) {
    await CommunicationCampaignRecipient.bulkWrite(
      operations,
      {
        ordered: false,
      }
    );
  }

  const skippedCount =
    recipientPayloads.filter(
      (recipient) =>
        recipient.status === "skipped"
    ).length;

  campaign.audience.estimatedRecipients =
    recipientPayloads.length -
    skippedCount;

  campaign.audience.calculatedAt =
    new Date();

  campaign.deliveryCounts.totalRecipients =
    recipientPayloads.length;

  campaign.deliveryCounts.skipped =
    skippedCount;

  campaign.deliveryCounts.queued = 0;
  campaign.deliveryCounts.sent = 0;
  campaign.deliveryCounts.delivered = 0;
  campaign.deliveryCounts.opened = 0;
  campaign.deliveryCounts.responded = 0;
  campaign.deliveryCounts.failed = 0;
  campaign.deliveryCounts.cancelled = 0;

  await campaign.save();

  return {
    campaign:
      await getCommunicationCampaign(
        campaign._id
      ),

    recipients: {
      total: recipientPayloads.length,
      eligible:
        recipientPayloads.length -
        skippedCount,
      skipped: skippedCount,
    },
  };
}

export async function launchCommunicationCampaign(
  campaignId,
  user
) {
  const campaign =
    await findCampaignDocument(campaignId);

  if (
    !["draft", "scheduled", "paused", "failed"].includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      `Campaigns with status “${campaign.status}” cannot be launched.`,
      409,
      "CAMPAIGN_LAUNCH_FORBIDDEN"
    );
  }

  let recipientCount =
    await CommunicationCampaignRecipient.countDocuments(
      {
        campaign: campaign._id,
      }
    );

  if (recipientCount === 0) {
    await prepareCampaignRecipients(
      campaign._id
    );

    recipientCount =
      await CommunicationCampaignRecipient.countDocuments(
        {
          campaign: campaign._id,
        }
      );
  }

  const eligibleCount =
    await CommunicationCampaignRecipient.countDocuments(
      {
        campaign: campaign._id,

        status: {
          $in: [
            "pending",
            "queued",
            "failed",
          ],
        },
      }
    );

  if (eligibleCount === 0) {
    throw createServiceError(
      "This campaign does not contain any eligible recipients.",
      409,
      "CAMPAIGN_HAS_NO_ELIGIBLE_RECIPIENTS"
    );
  }

  await CommunicationCampaignRecipient.updateMany(
    {
      campaign: campaign._id,

      status: {
        $in: [
          "pending",
          "failed",
        ],
      },
    },
    {
      $set: {
        status: "queued",
        queuedAt: new Date(),
        failureReason: "",
      },
    }
  );

  campaign.status = "queued";
  campaign.schedule.mode = "immediate";
  campaign.schedule.scheduledAt = null;

  if (!campaign.launchedAt) {
    campaign.launchedAt = new Date();
  }

  const userId = getUserId(user);

  if (userId) {
    campaign.updatedBy = userId;
  }

  await campaign.save();

  await createContactLogsForRecipients(
    campaign,
    user
  );

  await refreshCampaignDeliveryCounts(
    campaign._id
  );

  return getCommunicationCampaign(
    campaign._id
  );
}

export async function scheduleCommunicationCampaign(
  campaignId,
  schedule = {},
  user
) {
  const campaign =
    await findCampaignDocument(campaignId);

  assertCampaignEditable(campaign);

  const preparedSchedule =
    prepareSchedule({
      ...schedule,
      mode: "scheduled",
    });

  campaign.schedule = preparedSchedule;
  campaign.status = "scheduled";

  const userId = getUserId(user);

  if (userId) {
    campaign.updatedBy = userId;
  }

  await campaign.save();

  return getCommunicationCampaign(
    campaign._id
  );
}

export async function pauseCommunicationCampaign(
  campaignId,
  user
) {
  const campaign =
    await findCampaignDocument(campaignId);

  if (
    !["queued", "processing"].includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      "Only queued or processing campaigns can be paused.",
      409,
      "CAMPAIGN_PAUSE_FORBIDDEN"
    );
  }

  campaign.status = "paused";
  campaign.pausedAt = new Date();

  const userId = getUserId(user);

  if (userId) {
    campaign.updatedBy = userId;
  }

  await campaign.save();

  await CommunicationCampaignRecipient.updateMany(
    {
      campaign: campaign._id,
      status: "queued",
    },
    {
      $set: {
        status: "pending",
      },
    }
  );

  return getCommunicationCampaign(
    campaign._id
  );
}

export async function resumeCommunicationCampaign(
  campaignId,
  user
) {
  const campaign =
    await findCampaignDocument(campaignId);

  if (campaign.status !== "paused") {
    throw createServiceError(
      "Only paused campaigns can be resumed.",
      409,
      "CAMPAIGN_RESUME_FORBIDDEN"
    );
  }

  campaign.status = "queued";

  const userId = getUserId(user);

  if (userId) {
    campaign.updatedBy = userId;
  }

  await campaign.save();

  await CommunicationCampaignRecipient.updateMany(
    {
      campaign: campaign._id,
      status: "pending",
    },
    {
      $set: {
        status: "queued",
        queuedAt: new Date(),
      },
    }
  );

  await refreshCampaignDeliveryCounts(
    campaign._id
  );

  return getCommunicationCampaign(
    campaign._id
  );
}

export async function cancelCommunicationCampaign(
  campaignId,
  reason = "",
  user
) {
  const campaign =
    await findCampaignDocument(campaignId);

  if (
    ["completed", "partially_completed", "cancelled"].includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      `Campaigns with status “${campaign.status}” cannot be cancelled.`,
      409,
      "CAMPAIGN_CANCEL_FORBIDDEN"
    );
  }

  campaign.status = "cancelled";
  campaign.cancelledAt = new Date();
  campaign.failureReason =
    normalizeText(reason);

  const userId = getUserId(user);

  if (userId) {
    campaign.updatedBy = userId;
  }

  await campaign.save();

  await CommunicationCampaignRecipient.updateMany(
    {
      campaign: campaign._id,

      status: {
        $nin:
          TERMINAL_RECIPIENT_STATUSES,
      },
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
      },
    }
  );

  await refreshCampaignDeliveryCounts(
    campaign._id
  );

  return getCommunicationCampaign(
    campaign._id
  );
}

export async function listCampaignRecipients(
  campaignId,
  filters = {}
) {
  const campaignObjectId = toObjectId(
    campaignId,
    "campaignId"
  );

  const campaignExists =
    await CommunicationCampaign.exists({
      _id: campaignObjectId,
    });

  if (!campaignExists) {
    throw createServiceError(
      "Communication campaign not found.",
      404,
      "COMMUNICATION_CAMPAIGN_NOT_FOUND"
    );
  }

  const page = normalizePositiveInteger(
    filters.page,
    1,
    100000
  );

  const limit = normalizePositiveInteger(
    filters.limit,
    20,
    MAX_PAGE_SIZE
  );

  const match = {
    campaign: campaignObjectId,
  };

  if (filters.status) {
    validateEnumValue(
      filters.status,
      RECIPIENT_STATUSES,
      "status"
    );

    match.status = filters.status;
  }

  const search = normalizeText(filters.search);

  if (search) {
    const expression = new RegExp(
      escapeRegularExpression(search),
      "i"
    );

    match.$or = [
      {
        customerName: expression,
      },
      {
        recipient: expression,
      },
      {
        subject: expression,
      },
      {
        body: expression,
      },
    ];
  }

  const skip = (page - 1) * limit;

  const [recipients, total] =
    await Promise.all([
      CommunicationCampaignRecipient.find(
        match
      )
        .populate(
          "customer",
          "firstName lastName fullName name email phone phoneNumber mobile"
        )
        .populate(
          "appointment",
          "appointmentDate appointmentTime startTime status bookingReference"
        )
        .populate(
          "contactLog",
          "status sentAt deliveredAt openedAt respondedAt"
        )
        .sort({
          createdAt: 1,
          _id: 1,
        })
        .skip(skip)
        .limit(limit)
        .lean({
          virtuals: true,
        }),

      CommunicationCampaignRecipient.countDocuments(
        match
      ),
    ]);

  return {
    recipients,

    pagination: {
      page,
      limit,
      total,

      pages: Math.max(
        1,
        Math.ceil(total / limit)
      ),
    },
  };
}

export async function getCampaignRecipient(
  campaignId,
  recipientId
) {
  const campaignObjectId = toObjectId(
    campaignId,
    "campaignId"
  );

  const recipientObjectId = toObjectId(
    recipientId,
    "recipientId"
  );

  const recipient =
    await CommunicationCampaignRecipient.findOne(
      {
        _id: recipientObjectId,
        campaign: campaignObjectId,
      }
    )
      .populate(
        "customer",
        "firstName lastName fullName name email phone phoneNumber mobile"
      )
      .populate(
        "appointment",
        "appointmentDate appointmentTime startTime status bookingReference"
      )
      .populate(
        "contactLog",
        "status sentAt deliveredAt openedAt respondedAt"
      )
      .lean({
        virtuals: true,
      });

  if (!recipient) {
    throw createServiceError(
      "Campaign recipient not found.",
      404,
      "CAMPAIGN_RECIPIENT_NOT_FOUND"
    );
  }

  return recipient;
}

export async function refreshCampaignDeliveryCounts(
  campaignId
) {
  const campaign =
    await findCampaignDocument(campaignId);

  const statusCounts =
    await CommunicationCampaignRecipient.getCampaignStatusCounts(
      campaign._id
    );

  campaign.deliveryCounts = {
    totalRecipients:
      statusCounts.totalRecipients,

    queued:
      Number(statusCounts.pending || 0) +
      Number(statusCounts.queued || 0) +
      Number(statusCounts.processing || 0),

    sent: Number(statusCounts.sent || 0),

    delivered:
      Number(statusCounts.delivered || 0),

    opened:
      Number(statusCounts.opened || 0),

    responded:
      Number(statusCounts.responded || 0),

    failed:
      Number(statusCounts.failed || 0),

    skipped:
      Number(statusCounts.skipped || 0),

    cancelled:
      Number(statusCounts.cancelled || 0),
  };

  const completedCount =
    campaign.deliveryCounts.sent +
    campaign.deliveryCounts.delivered +
    campaign.deliveryCounts.opened +
    campaign.deliveryCounts.responded +
    campaign.deliveryCounts.failed +
    campaign.deliveryCounts.skipped +
    campaign.deliveryCounts.cancelled;

  if (
    campaign.deliveryCounts.totalRecipients >
      0 &&
    completedCount >=
      campaign.deliveryCounts.totalRecipients
  ) {
    if (
      campaign.deliveryCounts.failed > 0 ||
      campaign.deliveryCounts.skipped > 0
    ) {
      campaign.status =
        "partially_completed";
    } else {
      campaign.status = "completed";
    }

    campaign.completedAt = new Date();
  }

  await campaign.save();

  return {
    campaignId: String(campaign._id),
    status: campaign.status,
    deliveryCounts:
      campaign.deliveryCounts,
  };
}

export async function getCommunicationCampaignSummary(
  filters = {}
) {
  const match = buildCampaignMatch(filters);

  const [analytics] =
    await CommunicationCampaign.aggregate([
      {
        $match: match,
      },

      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,

                total: {
                  $sum: 1,
                },

                totalRecipients: {
                  $sum:
                    "$deliveryCounts.totalRecipients",
                },

                sent: {
                  $sum:
                    "$deliveryCounts.sent",
                },

                delivered: {
                  $sum:
                    "$deliveryCounts.delivered",
                },

                opened: {
                  $sum:
                    "$deliveryCounts.opened",
                },

                responded: {
                  $sum:
                    "$deliveryCounts.responded",
                },

                failed: {
                  $sum:
                    "$deliveryCounts.failed",
                },

                scheduled: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "scheduled",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                active: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          [
                            "queued",
                            "processing",
                            "paused",
                          ],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                completed: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          [
                            "completed",
                            "partially_completed",
                          ],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },

            {
              $project: {
                _id: 0,
                total: 1,
                totalRecipients: 1,
                sent: 1,
                delivered: 1,
                opened: 1,
                responded: 1,
                failed: 1,
                scheduled: 1,
                active: 1,
                completed: 1,
              },
            },
          ],

          byStatus: [
            {
              $group: {
                _id: "$status",

                count: {
                  $sum: 1,
                },
              },
            },

            {
              $project: {
                _id: 0,
                status: "$_id",
                count: 1,
              },
            },

            {
              $sort: {
                count: -1,
              },
            },
          ],

          byChannel: [
            {
              $group: {
                _id: "$channel",

                count: {
                  $sum: 1,
                },

                recipients: {
                  $sum:
                    "$deliveryCounts.totalRecipients",
                },
              },
            },

            {
              $project: {
                _id: 0,
                channel: "$_id",
                count: 1,
                recipients: 1,
              },
            },

            {
              $sort: {
                count: -1,
              },
            },
          ],

          byCampaignType: [
            {
              $group: {
                _id: "$campaignType",

                count: {
                  $sum: 1,
                },

                recipients: {
                  $sum:
                    "$deliveryCounts.totalRecipients",
                },

                responded: {
                  $sum:
                    "$deliveryCounts.responded",
                },
              },
            },

            {
              $project: {
                _id: 0,
                campaignType: "$_id",
                count: 1,
                recipients: 1,
                responded: 1,
              },
            },

            {
              $sort: {
                count: -1,
              },
            },
          ],

          upcomingScheduled: [
            {
              $match: {
                status: "scheduled",

                "schedule.scheduledAt": {
                  $gte: new Date(),
                },
              },
            },

            {
              $sort: {
                "schedule.scheduledAt": 1,
              },
            },

            {
              $limit: 5,
            },

            {
              $project: {
                name: 1,
                channel: 1,
                campaignType: 1,
                status: 1,
                schedule: 1,
                deliveryCounts: 1,
              },
            },
          ],
        },
      },
    ]);

  const summary =
    analytics?.summary?.[0] || {
      total: 0,
      totalRecipients: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      responded: 0,
      failed: 0,
      scheduled: 0,
      active: 0,
      completed: 0,
    };

  return {
    summary,

    byStatus:
      analytics?.byStatus || [],

    byChannel:
      analytics?.byChannel || [],

    byCampaignType:
      analytics?.byCampaignType || [],

    upcomingScheduled:
      analytics?.upcomingScheduled || [],
  };
}

const communicationCampaignService = {
  createCommunicationCampaign,
  listCommunicationCampaigns,
  getCommunicationCampaign,
  updateCommunicationCampaign,
  duplicateCommunicationCampaign,
  deleteCommunicationCampaign,
  previewCampaignAudience,
  prepareCampaignRecipients,
  launchCommunicationCampaign,
  scheduleCommunicationCampaign,
  pauseCommunicationCampaign,
  resumeCommunicationCampaign,
  cancelCommunicationCampaign,
  listCampaignRecipients,
  getCampaignRecipient,
  refreshCampaignDeliveryCounts,
  getCommunicationCampaignSummary,
};

export default communicationCampaignService;