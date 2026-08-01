import mongoose from "mongoose";

import CommunicationCampaign, {
  CAMPAIGN_STATUSES,
  COMMUNICATION_CHANNELS,
} from "../models/CommunicationCampaign.js";

const DEFAULT_TIMEZONE =
  "Europe/London";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1000;

const DEFAULT_BATCH_DELAY_SECONDS = 0;
const MAX_BATCH_DELAY_SECONDS = 86400;

const SCHEDULABLE_STATUSES = [
  "draft",
  "scheduled",
];

function createServiceError(
  message,
  statusCode = 400,
  code = "SCHEDULED_COMMUNICATION_ERROR"
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function normaliseText(value) {
  return String(value || "").trim();
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  const roundedValue =
    Math.floor(number);

  return Math.min(
    maximum,
    Math.max(minimum, roundedValue)
  );
}

function escapeRegularExpression(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function parseDate(
  value,
  fieldName,
  {
    required = false,
    futureOnly = false,
  } = {}
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      throw createServiceError(
        `${fieldName} is required.`,
        400,
        "SCHEDULE_DATE_REQUIRED"
      );
    }

    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      `${fieldName} must be a valid date and time.`,
      400,
      "INVALID_SCHEDULE_DATE"
    );
  }

  if (
    futureOnly &&
    date.getTime() <= Date.now()
  ) {
    throw createServiceError(
      `${fieldName} must be in the future.`,
      400,
      "SCHEDULE_DATE_NOT_FUTURE"
    );
  }

  return date;
}

function validateCampaignId(campaignId) {
  if (
    !mongoose.isValidObjectId(
      campaignId
    )
  ) {
    throw createServiceError(
      "The campaign ID is invalid.",
      400,
      "INVALID_CAMPAIGN_ID"
    );
  }
}

function validateUserId(userId) {
  if (
    userId &&
    !mongoose.isValidObjectId(userId)
  ) {
    throw createServiceError(
      "The user ID is invalid.",
      400,
      "INVALID_USER_ID"
    );
  }
}

function validateTimezone(timezone) {
  const normalisedTimezone =
    normaliseText(timezone) ||
    DEFAULT_TIMEZONE;

  if (
    normalisedTimezone.length > 100
  ) {
    throw createServiceError(
      "The timezone cannot exceed 100 characters.",
      400,
      "INVALID_TIMEZONE"
    );
  }

  try {
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          normalisedTimezone,
      }
    ).format(new Date());
  } catch {
    throw createServiceError(
      "The supplied timezone is not valid.",
      400,
      "INVALID_TIMEZONE"
    );
  }

  return normalisedTimezone;
}

function normaliseScheduleInput({
  scheduledAt,
  timezone,
  batchSize,
  delayBetweenBatchesSeconds,
}) {
  return {
    mode: "scheduled",

    scheduledAt: parseDate(
      scheduledAt,
      "Scheduled date and time",
      {
        required: true,
        futureOnly: true,
      }
    ),

    timezone:
      validateTimezone(timezone),

    batchSize:
      normaliseInteger(
        batchSize,
        DEFAULT_BATCH_SIZE,
        1,
        MAX_BATCH_SIZE
      ),

    delayBetweenBatchesSeconds:
      normaliseInteger(
        delayBetweenBatchesSeconds,
        DEFAULT_BATCH_DELAY_SECONDS,
        0,
        MAX_BATCH_DELAY_SECONDS
      ),
  };
}

function buildScheduledCommunicationFilter({
  status = "all",
  channel = "all",
  search = "",
  scheduledFrom,
  scheduledTo,
  includeUnscheduled = false,
} = {}) {
  const filters = [];

  if (!includeUnscheduled) {
    filters.push({
      "schedule.mode": "scheduled",
      "schedule.scheduledAt": {
        $ne: null,
      },
    });
  }

  const normalisedStatus =
    normaliseText(status).toLowerCase();

  if (
    normalisedStatus &&
    normalisedStatus !== "all"
  ) {
    if (
      !CAMPAIGN_STATUSES.includes(
        normalisedStatus
      )
    ) {
      throw createServiceError(
        `Unsupported campaign status: ${normalisedStatus}.`,
        400,
        "INVALID_CAMPAIGN_STATUS"
      );
    }

    filters.push({
      status: normalisedStatus,
    });
  }

  const normalisedChannel =
    normaliseText(channel).toLowerCase();

  if (
    normalisedChannel &&
    normalisedChannel !== "all"
  ) {
    if (
      !COMMUNICATION_CHANNELS.includes(
        normalisedChannel
      )
    ) {
      throw createServiceError(
        `Unsupported communication channel: ${normalisedChannel}.`,
        400,
        "INVALID_COMMUNICATION_CHANNEL"
      );
    }

    filters.push({
      channel: normalisedChannel,
    });
  }

  const fromDate = parseDate(
    scheduledFrom,
    "Scheduled-from date"
  );

  const toDate = parseDate(
    scheduledTo,
    "Scheduled-to date"
  );

  if (
    fromDate &&
    toDate &&
    fromDate > toDate
  ) {
    throw createServiceError(
      "The scheduled-from date cannot be after the scheduled-to date.",
      400,
      "INVALID_SCHEDULE_DATE_RANGE"
    );
  }

  if (fromDate || toDate) {
    const dateFilter = {};

    if (fromDate) {
      dateFilter.$gte = fromDate;
    }

    if (toDate) {
      dateFilter.$lte = toDate;
    }

    filters.push({
      "schedule.scheduledAt":
        dateFilter,
    });
  }

  const searchTerm =
    normaliseText(search);

  if (searchTerm) {
    const expression =
      new RegExp(
        escapeRegularExpression(
          searchTerm
        ),
        "i"
      );

    filters.push({
      $or: [
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
        {
          slug: expression,
        },
      ],
    });
  }

  if (filters.length === 0) {
    return {};
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return {
    $and: filters,
  };
}

async function findCampaignOrThrow(
  campaignId
) {
  validateCampaignId(campaignId);

  const campaign =
    await CommunicationCampaign.findById(
      campaignId
    );

  if (!campaign) {
    throw createServiceError(
      "The communication campaign was not found.",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  return campaign;
}

function populateCampaignQuery(query) {
  return query
    .populate(
      "template",
      "name channel subject body status"
    )
    .populate(
      "createdBy",
      "name email role"
    )
    .populate(
      "updatedBy",
      "name email role"
    );
}

export async function getScheduledCommunications({
  status = "all",
  channel = "all",
  search = "",
  scheduledFrom,
  scheduledTo,
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
  sortDirection = "asc",
} = {}) {
  const safePage =
    normaliseInteger(
      page,
      DEFAULT_PAGE,
      1,
      Number.MAX_SAFE_INTEGER
    );

  const safeLimit =
    normaliseInteger(
      limit,
      DEFAULT_LIMIT,
      1,
      MAX_LIMIT
    );

  const safeSortDirection =
    normaliseText(
      sortDirection
    ).toLowerCase() === "desc"
      ? -1
      : 1;

  const filter =
    buildScheduledCommunicationFilter({
      status,
      channel,
      search,
      scheduledFrom,
      scheduledTo,
    });

  const skip =
    (safePage - 1) * safeLimit;

  const [campaigns, total] =
    await Promise.all([
      populateCampaignQuery(
        CommunicationCampaign.find(
          filter
        )
      )
        .sort({
          "schedule.scheduledAt":
            safeSortDirection,
          createdAt: -1,
        })
        .skip(skip)
        .limit(safeLimit)
        .lean(),

      CommunicationCampaign.countDocuments(
        filter
      ),
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(total / safeLimit)
  );

  return {
    campaigns,

    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,

      hasNextPage:
        safePage < totalPages,

      hasPreviousPage:
        safePage > 1,
    },

    filters: {
      status,
      channel,
      search,
      scheduledFrom:
        scheduledFrom || null,
      scheduledTo:
        scheduledTo || null,
      sortDirection:
        safeSortDirection === 1
          ? "asc"
          : "desc",
    },
  };
}

export async function getScheduledCommunicationById(
  campaignId
) {
  validateCampaignId(campaignId);

  const campaign =
    await populateCampaignQuery(
      CommunicationCampaign.findById(
        campaignId
      )
    ).lean();

  if (!campaign) {
    throw createServiceError(
      "The scheduled communication was not found.",
      404,
      "SCHEDULED_COMMUNICATION_NOT_FOUND"
    );
  }

  return campaign;
}

export async function scheduleCommunicationCampaign({
  campaignId,
  scheduledAt,
  timezone = DEFAULT_TIMEZONE,
  batchSize = DEFAULT_BATCH_SIZE,
  delayBetweenBatchesSeconds =
    DEFAULT_BATCH_DELAY_SECONDS,
  userId = null,
}) {
  validateUserId(userId);

  const campaign =
    await findCampaignOrThrow(
      campaignId
    );

  if (
    !SCHEDULABLE_STATUSES.includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      `A campaign with status "${campaign.status}" cannot be scheduled.`,
      409,
      "CAMPAIGN_NOT_SCHEDULABLE"
    );
  }

  const schedule =
    normaliseScheduleInput({
      scheduledAt,
      timezone,
      batchSize,
      delayBetweenBatchesSeconds,
    });

  if (
    campaign.status === "draft" &&
    !campaign.canTransitionTo(
      "scheduled"
    )
  ) {
    throw createServiceError(
      "The campaign cannot transition from draft to scheduled.",
      409,
      "INVALID_CAMPAIGN_STATUS_TRANSITION"
    );
  }

  campaign.schedule = schedule;
  campaign.status = "scheduled";

  campaign.updatedBy =
    userId || campaign.updatedBy;

  campaign.failureReason = "";

  await campaign.save();

  return getScheduledCommunicationById(
    campaign._id
  );
}

export async function rescheduleCommunicationCampaign({
  campaignId,
  scheduledAt,
  timezone,
  batchSize,
  delayBetweenBatchesSeconds,
  userId = null,
}) {
  validateUserId(userId);

  const campaign =
    await findCampaignOrThrow(
      campaignId
    );

  if (campaign.status !== "scheduled") {
    throw createServiceError(
      "Only campaigns with scheduled status can be rescheduled.",
      409,
      "CAMPAIGN_NOT_SCHEDULED"
    );
  }

  const schedule =
    normaliseScheduleInput({
      scheduledAt,

      timezone:
        timezone ||
        campaign.schedule?.timezone ||
        DEFAULT_TIMEZONE,

      batchSize:
        batchSize ??
        campaign.schedule?.batchSize ??
        DEFAULT_BATCH_SIZE,

      delayBetweenBatchesSeconds:
        delayBetweenBatchesSeconds ??
        campaign.schedule
          ?.delayBetweenBatchesSeconds ??
        DEFAULT_BATCH_DELAY_SECONDS,
    });

  campaign.schedule = schedule;

  campaign.updatedBy =
    userId || campaign.updatedBy;

  await campaign.save();

  return getScheduledCommunicationById(
    campaign._id
  );
}

export async function unscheduleCommunicationCampaign({
  campaignId,
  userId = null,
}) {
  validateUserId(userId);

  const campaign =
    await findCampaignOrThrow(
      campaignId
    );

  if (campaign.status !== "scheduled") {
    throw createServiceError(
      "Only scheduled campaigns can be returned to draft.",
      409,
      "CAMPAIGN_NOT_SCHEDULED"
    );
  }

  if (
    !campaign.canTransitionTo("draft")
  ) {
    throw createServiceError(
      "The campaign cannot transition from scheduled to draft.",
      409,
      "INVALID_CAMPAIGN_STATUS_TRANSITION"
    );
  }

  campaign.status = "draft";

  campaign.schedule = {
    mode: "draft",
    scheduledAt: null,

    timezone:
      campaign.schedule?.timezone ||
      DEFAULT_TIMEZONE,

    batchSize:
      campaign.schedule?.batchSize ||
      DEFAULT_BATCH_SIZE,

    delayBetweenBatchesSeconds:
      campaign.schedule
        ?.delayBetweenBatchesSeconds ||
      DEFAULT_BATCH_DELAY_SECONDS,
  };

  campaign.updatedBy =
    userId || campaign.updatedBy;

  await campaign.save();

  return campaign.toJSON();
}

export async function cancelScheduledCommunication({
  campaignId,
  reason = "",
  userId = null,
}) {
  validateUserId(userId);

  const campaign =
    await findCampaignOrThrow(
      campaignId
    );

  if (campaign.status !== "scheduled") {
    throw createServiceError(
      "Only scheduled campaigns can be cancelled from the schedule.",
      409,
      "CAMPAIGN_NOT_SCHEDULED"
    );
  }

  if (
    !campaign.canTransitionTo(
      "cancelled"
    )
  ) {
    throw createServiceError(
      "The scheduled campaign cannot be cancelled.",
      409,
      "INVALID_CAMPAIGN_STATUS_TRANSITION"
    );
  }

  campaign.status = "cancelled";

  campaign.failureReason =
    normaliseText(reason);

  campaign.updatedBy =
    userId || campaign.updatedBy;

  await campaign.save();

  return getScheduledCommunicationById(
    campaign._id
  );
}

export async function getDueScheduledCommunications({
  scheduledBefore = new Date(),
  limit = 100,
} = {}) {
  const beforeDate = parseDate(
    scheduledBefore,
    "Scheduled-before date",
    {
      required: true,
    }
  );

  const safeLimit =
    normaliseInteger(
      limit,
      100,
      1,
      MAX_LIMIT
    );

  return populateCampaignQuery(
    CommunicationCampaign.findScheduledCampaigns(
      beforeDate
    )
  )
    .limit(safeLimit)
    .lean();
}

export async function getScheduledCommunicationOverview() {
  const now = new Date();

  const next24Hours =
    new Date(
      now.getTime() +
        24 * 60 * 60 * 1000
    );

  const baseFilter = {
    "schedule.mode": "scheduled",

    "schedule.scheduledAt": {
      $ne: null,
    },
  };

  const [
    total,
    currentlyScheduled,
    overdue,
    upcoming24Hours,
    completed,
    failed,
    cancelled,
    nextScheduled,
    statusGroups,
    channelGroups,
  ] = await Promise.all([
    CommunicationCampaign.countDocuments(
      baseFilter
    ),

    CommunicationCampaign.countDocuments({
      ...baseFilter,
      status: "scheduled",

      "schedule.scheduledAt": {
        $gte: now,
      },
    }),

    CommunicationCampaign.countDocuments({
      ...baseFilter,
      status: "scheduled",

      "schedule.scheduledAt": {
        $lt: now,
      },
    }),

    CommunicationCampaign.countDocuments({
      ...baseFilter,
      status: "scheduled",

      "schedule.scheduledAt": {
        $gte: now,
        $lte: next24Hours,
      },
    }),

    CommunicationCampaign.countDocuments({
      ...baseFilter,

      status: {
        $in: [
          "completed",
          "partially_completed",
        ],
      },
    }),

    CommunicationCampaign.countDocuments({
      ...baseFilter,
      status: "failed",
    }),

    CommunicationCampaign.countDocuments({
      ...baseFilter,
      status: "cancelled",
    }),

    populateCampaignQuery(
      CommunicationCampaign.findOne({
        ...baseFilter,
        status: "scheduled",

        "schedule.scheduledAt": {
          $gte: now,
        },
      })
    )
      .sort({
        "schedule.scheduledAt": 1,
      })
      .lean(),

    CommunicationCampaign.aggregate([
      {
        $match: baseFilter,
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]),

    CommunicationCampaign.aggregate([
      {
        $match: baseFilter,
      },
      {
        $group: {
          _id: "$channel",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]),
  ]);

  return {
    totals: {
      total,
      currentlyScheduled,
      overdue,
      upcoming24Hours,
      completed,
      failed,
      cancelled,
    },

    statusCounts:
      Object.fromEntries(
        statusGroups.map(
          ({ _id, count }) => [
            _id || "unknown",
            count,
          ]
        )
      ),

    channelCounts:
      Object.fromEntries(
        channelGroups.map(
          ({ _id, count }) => [
            _id || "unknown",
            count,
          ]
        )
      ),

    nextScheduled:
      nextScheduled || null,

    generatedAt:
      new Date().toISOString(),
  };
}