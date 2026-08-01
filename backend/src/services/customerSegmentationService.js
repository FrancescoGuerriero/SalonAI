import Customer from "../models/customer.js";

const DEFAULT_SEGMENT_SETTINGS = {
  newCustomerDays: 30,
  recentVisitDays: 90,
  dormantDays: 180,
  frequentVisitCount: 5,
  highValueSpend: 500,
};

const SEGMENT_NAMES = [
  "all",
  "active",
  "new",
  "recent",
  "dormant",
  "never-visited",
  "frequent",
  "high-value",
  "email-consent",
  "sms-consent",
  "archived",
];

function normalisePositiveNumber(
  value,
  fallback
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

function getDateBeforeDays(days) {
  const date = new Date();

  date.setDate(
    date.getDate() - Number(days)
  );

  return date;
}

export function getSegmentSettings(
  overrides = {}
) {
  return {
    newCustomerDays:
      normalisePositiveNumber(
        overrides.newCustomerDays,
        DEFAULT_SEGMENT_SETTINGS.newCustomerDays
      ),

    recentVisitDays:
      normalisePositiveNumber(
        overrides.recentVisitDays,
        DEFAULT_SEGMENT_SETTINGS.recentVisitDays
      ),

    dormantDays:
      normalisePositiveNumber(
        overrides.dormantDays,
        DEFAULT_SEGMENT_SETTINGS.dormantDays
      ),

    frequentVisitCount:
      normalisePositiveNumber(
        overrides.frequentVisitCount,
        DEFAULT_SEGMENT_SETTINGS.frequentVisitCount
      ),

    highValueSpend:
      normalisePositiveNumber(
        overrides.highValueSpend,
        DEFAULT_SEGMENT_SETTINGS.highValueSpend
      ),
  };
}

export function getAvailableSegments() {
  return [...SEGMENT_NAMES];
}

export function buildCustomerSegmentFilter(
  segment = "all",
  settingsOverrides = {}
) {
  const settings =
    getSegmentSettings(
      settingsOverrides
    );

  const normalisedSegment = String(
    segment || "all"
  )
    .trim()
    .toLowerCase();

  const newCustomerDate =
    getDateBeforeDays(
      settings.newCustomerDays
    );

  const recentVisitDate =
    getDateBeforeDays(
      settings.recentVisitDays
    );

  const dormantDate =
    getDateBeforeDays(
      settings.dormantDays
    );

  switch (normalisedSegment) {
    case "active":
      return {
        status: "active",
      };

    case "new":
      return {
        status: "active",
        createdAt: {
          $gte: newCustomerDate,
        },
      };

    case "recent":
      return {
        status: "active",
        lastVisit: {
          $gte: recentVisitDate,
        },
      };

    case "dormant":
      return {
        status: "active",
        lastVisit: {
          $ne: null,
          $lt: dormantDate,
        },
      };

    case "never-visited":
      return {
        status: "active",
        $or: [
          {
            lastVisit: null,
          },
          {
            lastVisit: {
              $exists: false,
            },
          },
          {
            visitCount: {
              $lte: 0,
            },
          },
        ],
      };

    case "frequent":
      return {
        status: "active",
        visitCount: {
          $gte:
            settings.frequentVisitCount,
        },
      };

    case "high-value":
      return {
        status: "active",
        totalSpent: {
          $gte:
            settings.highValueSpend,
        },
      };

    case "email-consent":
      return {
        status: "active",
        "marketing.emailConsent": true,
        email: {
          $exists: true,
          $nin: [null, ""],
        },
      };

    case "sms-consent":
      return {
        status: "active",
        "marketing.smsConsent": true,
        phone: {
          $exists: true,
          $nin: [null, ""],
        },
      };

    case "archived":
      return {
        status: "archived",
      };

    case "all":
    default:
      return {
        status: {
          $ne: "deleted",
        },
      };
  }
}

export function buildCustomerSearchFilter(
  searchTerm
) {
  const query = String(
    searchTerm || ""
  ).trim();

  if (!query) {
    return {};
  }

  const escapedQuery = query.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const searchExpression =
    new RegExp(escapedQuery, "i");

  return {
    $or: [
      {
        firstName:
          searchExpression,
      },
      {
        lastName:
          searchExpression,
      },
      {
        email: searchExpression,
      },
      {
        phone: searchExpression,
      },
      {
        notes: searchExpression,
      },
    ],
  };
}

export function combineFilters(
  ...filters
) {
  const validFilters = filters.filter(
    (filter) =>
      filter &&
      typeof filter === "object" &&
      Object.keys(filter).length > 0
  );

  if (validFilters.length === 0) {
    return {};
  }

  if (validFilters.length === 1) {
    return validFilters[0];
  }

  return {
    $and: validFilters,
  };
}

export async function getCustomersBySegment({
  segment = "all",
  search = "",
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  sortDirection = "desc",
  settings = {},
} = {}) {
  const safePage = Math.max(
    1,
    Number(page) || 1
  );

  const safeLimit = Math.min(
    100,
    Math.max(
      1,
      Number(limit) || 20
    )
  );

  const allowedSortFields = [
    "firstName",
    "lastName",
    "createdAt",
    "updatedAt",
    "lastVisit",
    "visitCount",
    "totalSpent",
    "loyaltyPoints",
  ];

  const safeSortField =
    allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";

  const safeSortDirection =
    String(sortDirection)
      .toLowerCase() === "asc"
      ? 1
      : -1;

  const segmentFilter =
    buildCustomerSegmentFilter(
      segment,
      settings
    );

  const searchFilter =
    buildCustomerSearchFilter(search);

  const filter = combineFilters(
    segmentFilter,
    searchFilter
  );

  const skip =
    (safePage - 1) * safeLimit;

  const [customers, total] =
    await Promise.all([
      Customer.find(filter)
        .populate(
          "preferredStylist",
          "firstName lastName name email"
        )
        .sort({
          [safeSortField]:
            safeSortDirection,
        })
        .skip(skip)
        .limit(safeLimit)
        .lean(),

      Customer.countDocuments(filter),
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(total / safeLimit)
  );

  return {
    segment,
    customers,
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
  };
}

export async function getCustomerSegmentOverview(
  settingsOverrides = {}
) {
  const settings =
    getSegmentSettings(
      settingsOverrides
    );

  const segments = [
    "all",
    "active",
    "new",
    "recent",
    "dormant",
    "never-visited",
    "frequent",
    "high-value",
    "email-consent",
    "sms-consent",
    "archived",
  ];

  const segmentCounts =
    await Promise.all(
      segments.map(
        async (segment) => {
          const count =
            await Customer.countDocuments(
              buildCustomerSegmentFilter(
                segment,
                settings
              )
            );

          return [
            segment,
            count,
          ];
        }
      )
    );

  const counts =
    Object.fromEntries(
      segmentCounts
    );

  const valueSummary =
    await Customer.aggregate([
      {
        $match: {
          status: {
            $ne: "deleted",
          },
        },
      },
      {
        $group: {
          _id: null,

          totalSpent: {
            $sum: {
              $ifNull: [
                "$totalSpent",
                0,
              ],
            },
          },

          totalVisits: {
            $sum: {
              $ifNull: [
                "$visitCount",
                0,
              ],
            },
          },

          averageSpend: {
            $avg: {
              $ifNull: [
                "$totalSpent",
                0,
              ],
            },
          },

          averageVisits: {
            $avg: {
              $ifNull: [
                "$visitCount",
                0,
              ],
            },
          },
        },
      },
    ]);

  const values =
    valueSummary[0] || {
      totalSpent: 0,
      totalVisits: 0,
      averageSpend: 0,
      averageVisits: 0,
    };

  return {
    counts,

    values: {
      totalSpent:
        values.totalSpent || 0,

      totalVisits:
        values.totalVisits || 0,

      averageSpend:
        values.averageSpend || 0,

      averageVisits:
        values.averageVisits || 0,
    },

    settings,
  };
}