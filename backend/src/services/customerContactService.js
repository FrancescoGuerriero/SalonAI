import mongoose from "mongoose";

import CustomerContactLog from "../models/customerContactLog.js";
import Customer from "../models/Customer.js";

const CONTACT_STATUSES = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "opened",
  "responded",
  "failed",
  "cancelled",
];

const CONTACT_CHANNELS = [
  "email",
  "sms",
  "phone",
  "whatsapp",
  "in_app",
];

const CAMPAIGN_TYPES = [
  "dormant_customer",
  "appointment_reminder",
  "follow_up",
  "promotion",
  "birthday",
  "general",
];

const DIRECTIONS = ["outbound", "inbound"];

const SENT_STATES = [
  "sent",
  "delivered",
  "opened",
  "responded",
];

const DELIVERED_STATES = [
  "delivered",
  "opened",
  "responded",
];

const OPENED_STATES = [
  "opened",
  "responded",
];

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value, fieldName) {
  if (!value || !isValidObjectId(value)) {
    throw createServiceError(
      `${fieldName} must be a valid MongoDB ID.`,
      400
    );
  }

  return new mongoose.Types.ObjectId(value);
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

function normalizeDate(value, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      `Invalid date value: ${value}`,
      400
    );
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizePercentage(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(1));
}

function calculatePercentage(numerator, denominator) {
  const safeNumerator = Number(numerator) || 0;
  const safeDenominator = Number(denominator) || 0;

  if (safeDenominator <= 0) {
    return 0;
  }

  return normalizePercentage(
    (safeNumerator / safeDenominator) * 100
  );
}

function getUserId(user) {
  const candidate =
    user?._id ||
    user?.id ||
    user;

  if (!candidate || !isValidObjectId(candidate)) {
    return undefined;
  }

  return candidate;
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
      400
    );
  }
}

function buildDateMatch({
  days,
  startDate,
  endDate,
} = {}) {
  const dateFilter = {};

  if (startDate) {
    dateFilter.$gte = normalizeDate(
      startDate,
      false
    );
  } else if (days) {
    const safeDays = normalizePositiveInteger(
      days,
      30,
      3650
    );

    const calculatedStartDate = new Date();

    calculatedStartDate.setHours(0, 0, 0, 0);
    calculatedStartDate.setDate(
      calculatedStartDate.getDate() -
        (safeDays - 1)
    );

    dateFilter.$gte = calculatedStartDate;
  }

  if (endDate) {
    dateFilter.$lte = normalizeDate(
      endDate,
      true
    );
  }

  return Object.keys(dateFilter).length > 0
    ? dateFilter
    : undefined;
}

function buildContactMatch(filters = {}) {
  const match = {};

  if (filters.customer) {
    match.customer = toObjectId(
      filters.customer,
      "customer"
    );
  }

  if (filters.appointment) {
    match.appointment = toObjectId(
      filters.appointment,
      "appointment"
    );
  }

  if (filters.createdBy) {
    match.createdBy = toObjectId(
      filters.createdBy,
      "createdBy"
    );
  }

  if (filters.campaignType) {
    validateEnumValue(
      filters.campaignType,
      CAMPAIGN_TYPES,
      "campaignType"
    );

    match.campaignType = filters.campaignType;
  }

  if (filters.channel) {
    validateEnumValue(
      filters.channel,
      CONTACT_CHANNELS,
      "channel"
    );

    match.channel = filters.channel;
  }

  if (filters.status) {
    validateEnumValue(
      filters.status,
      CONTACT_STATUSES,
      "status"
    );

    match.status = filters.status;
  }

  if (filters.direction) {
    validateEnumValue(
      filters.direction,
      DIRECTIONS,
      "direction"
    );

    match.direction = filters.direction;
  }

  const createdAt = buildDateMatch(filters);

  if (createdAt) {
    match.createdAt = createdAt;
  }

  const search = normalizeText(filters.search);

  if (search) {
    const escapedSearch = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const searchExpression = new RegExp(
      escapedSearch,
      "i"
    );

    match.$or = [
      {
        subject: searchExpression,
      },
      {
        message: searchExpression,
      },
      {
        recipient: searchExpression,
      },
      {
        externalMessageId: searchExpression,
      },
    ];
  }

  return match;
}

function getStatusTimestampUpdates(status) {
  const now = new Date();

  switch (status) {
    case "sent":
      return {
        sentAt: now,
      };

    case "delivered":
      return {
        sentAt: now,
        deliveredAt: now,
      };

    case "opened":
      return {
        sentAt: now,
        deliveredAt: now,
        openedAt: now,
      };

    case "responded":
      return {
        sentAt: now,
        deliveredAt: now,
        openedAt: now,
        respondedAt: now,
      };

    default:
      return {};
  }
}

async function findCustomer(customerValue) {
  if (
    customerValue &&
    typeof customerValue === "object" &&
    customerValue._id
  ) {
    return customerValue;
  }

  const customerId = toObjectId(
    customerValue,
    "customer"
  );

  const customer = await Customer.findById(
    customerId
  );

  if (!customer) {
    throw createServiceError(
      "Customer not found.",
      404
    );
  }

  return customer;
}

export async function resolveCustomerRecipient(
  customerValue,
  channel
) {
  validateEnumValue(
    channel,
    CONTACT_CHANNELS,
    "channel"
  );

  const customer = await findCustomer(
    customerValue
  );

  const email = normalizeText(customer.email);

  const phone = normalizeText(
    customer.phone ||
      customer.phoneNumber ||
      customer.mobile
  );

  switch (channel) {
    case "email":
      if (!email) {
        throw createServiceError(
          "The customer does not have an email address.",
          400
        );
      }

      return email;

    case "sms":
    case "phone":
    case "whatsapp":
      if (!phone) {
        throw createServiceError(
          "The customer does not have a phone number.",
          400
        );
      }

      return phone;

    case "in_app":
      return String(customer._id);

    default:
      throw createServiceError(
        "Unsupported communication channel.",
        400
      );
  }
}

export async function createContactLog(
  payload = {},
  user
) {
  const customer = await findCustomer(
    payload.customer
  );

  const channel = payload.channel || "email";

  validateEnumValue(
    channel,
    CONTACT_CHANNELS,
    "channel"
  );

  const campaignType =
    payload.campaignType || "general";

  validateEnumValue(
    campaignType,
    CAMPAIGN_TYPES,
    "campaignType"
  );

  const direction =
    payload.direction || "outbound";

  validateEnumValue(
    direction,
    DIRECTIONS,
    "direction"
  );

  const status = payload.status || "draft";

  validateEnumValue(
    status,
    CONTACT_STATUSES,
    "status"
  );

  const recipient =
    normalizeText(payload.recipient) ||
    (await resolveCustomerRecipient(
      customer,
      channel
    ));

  const timestampUpdates =
    getStatusTimestampUpdates(status);

  const contactLog =
    await CustomerContactLog.create({
      customer: customer._id,

      appointment:
        payload.appointment &&
        isValidObjectId(payload.appointment)
          ? payload.appointment
          : undefined,

      campaignType,
      channel,
      direction,

      subject: normalizeText(payload.subject),
      message: normalizeText(payload.message),

      status,
      recipient,

      externalMessageId: normalizeText(
        payload.externalMessageId
      ),

      failureReason: normalizeText(
        payload.failureReason
      ),

      sentAt:
        payload.sentAt ||
        timestampUpdates.sentAt,

      deliveredAt:
        payload.deliveredAt ||
        timestampUpdates.deliveredAt,

      openedAt:
        payload.openedAt ||
        timestampUpdates.openedAt,

      respondedAt:
        payload.respondedAt ||
        timestampUpdates.respondedAt,

      createdBy: getUserId(user),

      metadata:
        payload.metadata &&
        typeof payload.metadata === "object"
          ? payload.metadata
          : {},
    });

  return getContactLog(contactLog._id);
}

export async function getContactLog(
  contactLogId
) {
  const id = toObjectId(
    contactLogId,
    "contactLogId"
  );

  const contactLog = await CustomerContactLog.findById(
    id
  )
    .populate(
      "customer",
      "firstName lastName fullName name email phone phoneNumber mobile"
    )
    .populate(
      "appointment",
      "appointmentDate appointmentTime status"
    )
    .populate(
      "createdBy",
      "name firstName lastName email"
    )
    .lean();

  if (!contactLog) {
    throw createServiceError(
      "Customer contact record not found.",
      404
    );
  }

  return contactLog;
}

export async function listContactLogs(
  filters = {}
) {
  const page = normalizePositiveInteger(
    filters.page,
    1,
    100000
  );

  const limit = normalizePositiveInteger(
    filters.limit,
    10,
    100
  );

  const skip = (page - 1) * limit;
  const match = buildContactMatch(filters);

  const [contactLogs, total] =
    await Promise.all([
      CustomerContactLog.find(match)
        .populate(
          "customer",
          "firstName lastName fullName name email phone phoneNumber mobile"
        )
        .populate(
          "appointment",
          "appointmentDate appointmentTime status"
        )
        .populate(
          "createdBy",
          "name firstName lastName email"
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      CustomerContactLog.countDocuments(
        match
      ),
    ]);

  return {
    contactLogs,

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

export async function getCustomerContactHistory(
  customerId,
  filters = {}
) {
  const customerObjectId = toObjectId(
    customerId,
    "customerId"
  );

  const customerExists =
    await Customer.exists({
      _id: customerObjectId,
    });

  if (!customerExists) {
    throw createServiceError(
      "Customer not found.",
      404
    );
  }

  return listContactLogs({
    ...filters,
    customer: customerObjectId,
  });
}

export async function updateContactLog(
  contactLogId,
  payload = {},
  user
) {
  const id = toObjectId(
    contactLogId,
    "contactLogId"
  );

  const contactLog =
    await CustomerContactLog.findById(id);

  if (!contactLog) {
    throw createServiceError(
      "Customer contact record not found.",
      404
    );
  }

  if (payload.customer !== undefined) {
    const customer = await findCustomer(
      payload.customer
    );

    contactLog.customer = customer._id;
  }

  if (payload.appointment !== undefined) {
    contactLog.appointment =
      payload.appointment &&
      isValidObjectId(payload.appointment)
        ? payload.appointment
        : null;
  }

  if (payload.campaignType !== undefined) {
    validateEnumValue(
      payload.campaignType,
      CAMPAIGN_TYPES,
      "campaignType"
    );

    contactLog.campaignType =
      payload.campaignType;
  }

  if (payload.channel !== undefined) {
    validateEnumValue(
      payload.channel,
      CONTACT_CHANNELS,
      "channel"
    );

    contactLog.channel = payload.channel;
  }

  if (payload.direction !== undefined) {
    validateEnumValue(
      payload.direction,
      DIRECTIONS,
      "direction"
    );

    contactLog.direction =
      payload.direction;
  }

  if (payload.subject !== undefined) {
    contactLog.subject = normalizeText(
      payload.subject
    );
  }

  if (payload.message !== undefined) {
    contactLog.message = normalizeText(
      payload.message
    );
  }

  if (payload.recipient !== undefined) {
    contactLog.recipient = normalizeText(
      payload.recipient
    );
  }

  if (
    payload.externalMessageId !== undefined
  ) {
    contactLog.externalMessageId =
      normalizeText(
        payload.externalMessageId
      );
  }

  if (payload.failureReason !== undefined) {
    contactLog.failureReason =
      normalizeText(payload.failureReason);
  }

  if (payload.metadata !== undefined) {
    contactLog.metadata =
      payload.metadata &&
      typeof payload.metadata === "object"
        ? payload.metadata
        : {};
  }

  if (payload.status !== undefined) {
    validateEnumValue(
      payload.status,
      CONTACT_STATUSES,
      "status"
    );

    contactLog.status = payload.status;

    const timestampUpdates =
      getStatusTimestampUpdates(
        payload.status
      );

    for (const [field, value] of Object.entries(
      timestampUpdates
    )) {
      if (!contactLog[field]) {
        contactLog[field] = value;
      }
    }
  }

  const updatedBy = getUserId(user);

  if (updatedBy) {
    contactLog.metadata = {
      ...(contactLog.metadata || {}),
      lastUpdatedBy: updatedBy,
    };
  }

  await contactLog.save();

  return getContactLog(contactLog._id);
}

export async function updateContactStatus(
  contactLogId,
  status,
  details = {}
) {
  validateEnumValue(
    status,
    CONTACT_STATUSES,
    "status"
  );

  const id = toObjectId(
    contactLogId,
    "contactLogId"
  );

  const contactLog =
    await CustomerContactLog.findById(id);

  if (!contactLog) {
    throw createServiceError(
      "Customer contact record not found.",
      404
    );
  }

  contactLog.status = status;

  const timestampUpdates =
    getStatusTimestampUpdates(status);

  for (const [field, value] of Object.entries(
    timestampUpdates
  )) {
    if (!contactLog[field]) {
      contactLog[field] =
        details[field] || value;
    }
  }

  if (details.externalMessageId !== undefined) {
    contactLog.externalMessageId =
      normalizeText(
        details.externalMessageId
      );
  }

  if (details.failureReason !== undefined) {
    contactLog.failureReason =
      normalizeText(details.failureReason);
  }

  if (
    details.metadata &&
    typeof details.metadata === "object"
  ) {
    contactLog.metadata = {
      ...(contactLog.metadata || {}),
      ...details.metadata,
    };
  }

  await contactLog.save();

  return getContactLog(contactLog._id);
}

export async function deleteContactLog(
  contactLogId
) {
  const id = toObjectId(
    contactLogId,
    "contactLogId"
  );

  const deletedContactLog =
    await CustomerContactLog.findByIdAndDelete(
      id
    );

  if (!deletedContactLog) {
    throw createServiceError(
      "Customer contact record not found.",
      404
    );
  }

  return {
    message:
      "Customer contact record deleted successfully.",
    contactLogId: String(
      deletedContactLog._id
    ),
  };
}

export async function getCampaignSummary(
  filters = {}
) {
  const match = buildContactMatch({
    days: filters.days || 30,
    startDate: filters.startDate,
    endDate: filters.endDate,
    campaignType: filters.campaignType,
    channel: filters.channel,
    direction: filters.direction,
    createdBy: filters.createdBy,
  });

  const [analytics] =
    await CustomerContactLog.aggregate([
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

                customers: {
                  $addToSet: "$customer",
                },

                sent: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          SENT_STATES,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                delivered: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          DELIVERED_STATES,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                opened: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          OPENED_STATES,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                responded: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "responded",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                failed: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "failed",
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
                uniqueCustomers: {
                  $size: "$customers",
                },
                sent: 1,
                delivered: 1,
                opened: 1,
                responded: 1,
                failed: 1,
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

                sent: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          SENT_STATES,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                responded: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "responded",
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
                channel: "$_id",
                count: 1,
                sent: 1,
                responded: 1,
              },
            },

            {
              $sort: {
                count: -1,
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

          byCampaign: [
            {
              $group: {
                _id: "$campaignType",

                total: {
                  $sum: 1,
                },

                sent: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$status",
                          SENT_STATES,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },

                responded: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          "$status",
                          "responded",
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
                campaignType: "$_id",
                total: 1,
                sent: 1,
                responded: 1,
              },
            },

            {
              $sort: {
                total: -1,
              },
            },
          ],
        },
      },
    ]);

  const rawSummary =
    analytics?.summary?.[0] || {
      total: 0,
      uniqueCustomers: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      responded: 0,
      failed: 0,
    };

  const summary = {
    ...rawSummary,

    deliveryRate: calculatePercentage(
      rawSummary.delivered,
      rawSummary.sent
    ),

    openRate: calculatePercentage(
      rawSummary.opened,
      rawSummary.delivered
    ),

    responseRate: calculatePercentage(
      rawSummary.responded,
      rawSummary.delivered
    ),
  };

  return {
    summary,
    byChannel: analytics?.byChannel || [],
    byStatus: analytics?.byStatus || [],
    byCampaign: analytics?.byCampaign || [],

    period: {
      days: normalizePositiveInteger(
        filters.days,
        30,
        3650
      ),

      startDate:
        match.createdAt?.$gte || null,

      endDate:
        match.createdAt?.$lte ||
        new Date(),
    },
  };
}

const customerContactService = {
  createContactLog,
  resolveCustomerRecipient,
  getContactLog,
  listContactLogs,
  getCustomerContactHistory,
  updateContactLog,
  updateContactStatus,
  deleteContactLog,
  getCampaignSummary,
};

export default customerContactService;