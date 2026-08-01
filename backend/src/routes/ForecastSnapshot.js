import Customer from "../../models/Customer.js";
import Appointment from "../../models/Appointment.js";
import CustomerSegment from "./CustomerSegment.js";
import CustomerTagAssignment from "../customerProfiles/CustomerTagAssignment.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  paginationFromQuery,
  paginationResult,
} from "../../shared/pagination.js";
import { userId } from "../../shared/modelHelpers.js";

function compare(actual, operator, expected) {
  switch (operator) {
    case "eq":
      return String(actual) === String(expected);
    case "neq":
      return String(actual) !== String(expected);
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "in":
      return Array.isArray(expected)
        ? expected.map(String).includes(String(actual))
        : String(expected)
            .split(",")
            .map((item) => item.trim())
            .includes(String(actual));
    case "not_in":
      return !compare(actual, "in", expected);
    case "contains":
      return String(actual || "")
        .toLowerCase()
        .includes(String(expected || "").toLowerCase());
    default:
      return false;
  }
}

function daysSince(value) {
  if (!value) {
    return 99999;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(value).getTime()) /
        86400000
    )
  );
}

async function customerAnalytics(customerIds) {
  const appointmentMetrics =
    await Appointment.aggregate([
      {
        $match: {
          customer: {
            $in: customerIds,
          },
        },
      },
      {
        $group: {
          _id: "$customer",
          appointmentCount: {
            $sum: {
              $cond: [
                {
                  $not: {
                    $in: [
                      "$status",
                      ["cancelled", "no_show"],
                    ],
                  },
                },
                1,
                0,
              ],
            },
          },
          totalSpend: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "completed"],
                },
                {
                  $ifNull: [
                    "$totalPrice",
                    {
                      $ifNull: ["$price", 0],
                    },
                  ],
                },
                0,
              ],
            },
          },
          lastAppointmentAt: {
            $max: {
              $cond: [
                {
                  $not: {
                    $in: [
                      "$status",
                      ["cancelled", "no_show"],
                    ],
                  },
                },
                "$appointmentDate",
                null,
              ],
            },
          },
          serviceCounts: {
            $push: "$service",
          },
          stylistCounts: {
            $push: "$stylist",
          },
        },
      },
    ]);

  const tagAssignments =
    await CustomerTagAssignment.find({
      customer: {
        $in: customerIds,
      },
    })
      .populate("tag", "name label")
      .lean();

  const tagsByCustomer = new Map();

  for (const assignment of tagAssignments) {
    const key = String(assignment.customer);
    const values = tagsByCustomer.get(key) || [];
    values.push(
      assignment.tag?.name ||
        assignment.tag?.label ||
        String(assignment.tag?._id || "")
    );
    tagsByCustomer.set(key, values);
  }

  const metricsByCustomer = new Map();

  for (const metric of appointmentMetrics) {
    metricsByCustomer.set(String(metric._id), {
      ...metric,
      daysSinceLastAppointment: daysSince(
        metric.lastAppointmentAt
      ),
      tags:
        tagsByCustomer.get(String(metric._id)) || [],
    });
  }

  for (const id of customerIds) {
    const key = String(id);

    if (!metricsByCustomer.has(key)) {
      metricsByCustomer.set(key, {
        appointmentCount: 0,
        totalSpend: 0,
        lastAppointmentAt: null,
        daysSinceLastAppointment: 99999,
        serviceCounts: [],
        stylistCounts: [],
        tags: tagsByCustomer.get(key) || [],
      });
    }
  }

  return metricsByCustomer;
}

function mostFrequent(values = []) {
  const counts = new Map();

  for (const value of values.filter(Boolean)) {
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];
}

function matchesRule(customer, metrics, rule) {
  let actual;

  switch (rule.field) {
    case "appointmentCount":
      actual = metrics.appointmentCount;
      break;
    case "totalSpend":
      actual = metrics.totalSpend;
      break;
    case "daysSinceLastAppointment":
      actual = metrics.daysSinceLastAppointment;
      break;
    case "preferredService":
      actual = mostFrequent(metrics.serviceCounts);
      break;
    case "preferredStylist":
      actual = mostFrequent(metrics.stylistCounts);
      break;
    case "tag":
      return metrics.tags.some((tag) =>
        compare(tag, rule.operator, rule.value)
      );
    case "createdAt":
      actual = customer.createdAt;
      break;
    default:
      return false;
  }

  return compare(actual, rule.operator, rule.value);
}

export async function createSegment(payload, user) {
  if (!String(payload.name || "").trim()) {
    throw createServiceError(
      "Segment name is required.",
      400
    );
  }

  const segment = await CustomerSegment.create({
    name: String(payload.name).trim(),
    description: String(
      payload.description || ""
    ).trim(),
    matchMode: payload.matchMode || "all",
    rules: Array.isArray(payload.rules)
      ? payload.rules
      : [],
    staticCustomers: Array.isArray(
      payload.staticCustomers
    )
      ? payload.staticCustomers
      : [],
    active:
      payload.active === undefined
        ? true
        : Boolean(payload.active),
    createdBy: userId(user),
    updatedBy: userId(user),
  });

  return segment.toObject();
}

export async function listSegments(query = {}) {
  const { page, limit, skip } =
    paginationFromQuery(query);

  const match = {};

  if (query.active !== undefined) {
    match.active =
      String(query.active).toLowerCase() === "true";
  }

  const [items, total] = await Promise.all([
    CustomerSegment.find(match)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CustomerSegment.countDocuments(match),
  ]);

  return {
    items,
    pagination: paginationResult(
      page,
      limit,
      total
    ),
  };
}

export async function getSegment(id) {
  return assertFound(
    await CustomerSegment.findById(id)
      .populate(
        "staticCustomers",
        "firstName lastName fullName name email phone phoneNumber mobile"
      )
      .lean(),
    "Customer segment not found."
  );
}

export async function updateSegment(
  id,
  payload,
  user
) {
  const segment = assertFound(
    await CustomerSegment.findById(id),
    "Customer segment not found."
  );

  for (const field of [
    "name",
    "description",
    "matchMode",
    "rules",
    "staticCustomers",
    "active",
  ]) {
    if (payload[field] !== undefined) {
      segment[field] = payload[field];
    }
  }

  segment.updatedBy = userId(user);
  await segment.save();

  return segment.toObject();
}

export async function deleteSegment(id) {
  const result =
    await CustomerSegment.findByIdAndDelete(id);

  assertFound(result, "Customer segment not found.");

  return {
    message: "Customer segment deleted.",
    id: String(result._id),
  };
}

export async function previewSegment(
  id,
  {
    limit = 500,
  } = {}
) {
  const segment = await getSegment(id);

  const customers = await Customer.find({})
    .select(
      "firstName lastName fullName name email phone phoneNumber mobile createdAt"
    )
    .limit(Math.min(Number(limit) || 500, 5000))
    .lean();

  const analytics = await customerAnalytics(
    customers.map((customer) => customer._id)
  );

  const staticSet = new Set(
    (segment.staticCustomers || []).map((customer) =>
      String(customer._id || customer)
    )
  );

  const matches = customers.filter((customer) => {
    const metrics = analytics.get(
      String(customer._id)
    );

    const ruleResults = segment.rules.map((rule) =>
      matchesRule(customer, metrics, rule)
    );

    const rulesMatch =
      ruleResults.length === 0
        ? true
        : segment.matchMode === "any"
          ? ruleResults.some(Boolean)
          : ruleResults.every(Boolean);

    if (staticSet.size > 0) {
      return (
        staticSet.has(String(customer._id)) ||
        rulesMatch
      );
    }

    return rulesMatch;
  });

  return {
    segment,
    count: matches.length,
    customers: matches,
  };
}
