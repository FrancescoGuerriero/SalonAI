import CommunicationCampaign from "../models/CommunicationCampaign.js";
import {
  communicationAggregateAuthorityFilter,
} from "../services/communicationEffectiveAuthorityService.js";

function text(value) {
  return String(value ?? "").trim();
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function combine(scope, filter = {}) {
  return { $and: [scope, filter] };
}

function scheduledFilter(query = {}) {
  const filter = {};

  const includeUnscheduled =
    String(query.includeUnscheduled ?? "false").toLowerCase() === "true";

  if (!includeUnscheduled) {
    filter["schedule.mode"] = "scheduled";
    filter["schedule.scheduledAt"] = { $ne: null };
  }

  if (query.status && query.status !== "all") {
    filter.status = text(query.status);
  }
  if (query.channel && query.channel !== "all") {
    filter.channel = text(query.channel);
  }

  const search = text(query.search);
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: expression },
      { description: expression },
      { subject: expression },
      { body: expression },
    ];
  }

  const range = {};
  if (query.scheduledFrom) {
    const from = new Date(query.scheduledFrom);
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }
  if (query.scheduledTo) {
    const to = new Date(query.scheduledTo);
    if (!Number.isNaN(to.getTime())) range.$lte = to;
  }
  if (Object.keys(range).length > 0) {
    filter["schedule.scheduledAt"] = {
      ...(filter["schedule.scheduledAt"] || {}),
      ...range,
    };
  }

  return filter;
}

export async function listScopedScheduledCommunications(
  request,
  response,
  next
) {
  try {
    const page = positiveInteger(request.query.page, 1, 100000);
    const limit = positiveInteger(request.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const direction = text(request.query.sortDirection).toLowerCase() === "desc" ? -1 : 1;
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combine(scope, scheduledFilter(request.query));

    const [campaigns, total] = await Promise.all([
      CommunicationCampaign.find(match)
        .populate("template", "name slug channel campaignType active")
        .sort({ "schedule.scheduledAt": direction, _id: direction })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      CommunicationCampaign.countDocuments(match),
    ]);

    return response.status(200).json({
      success: true,
      message: "Scheduled communications retrieved successfully.",
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getScopedScheduledCommunicationOverview(
  request,
  response,
  next
) {
  try {
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const match = combine(scope, {
      "schedule.mode": "scheduled",
      "schedule.scheduledAt": { $ne: null },
    });

    const [rows, total, nextCampaign] = await Promise.all([
      CommunicationCampaign.aggregate([
        { $match: match },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      CommunicationCampaign.countDocuments(match),
      CommunicationCampaign.findOne(
        combine(scope, {
          status: "scheduled",
          "schedule.mode": "scheduled",
          "schedule.scheduledAt": { $gte: new Date() },
        })
      )
        .sort({ "schedule.scheduledAt": 1 })
        .lean(),
    ]);

    return response.status(200).json({
      success: true,
      message: "Scheduled communication overview retrieved successfully.",
      overview: {
        total,
        byStatus: Object.fromEntries(
          rows.map((row) => [String(row._id || "unknown"), row.count])
        ),
        nextScheduledAt: nextCampaign?.schedule?.scheduledAt || null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listScopedDueScheduledCommunications(
  request,
  response,
  next
) {
  try {
    const scheduledBefore = request.query.scheduledBefore
      ? new Date(request.query.scheduledBefore)
      : new Date();

    if (Number.isNaN(scheduledBefore.getTime())) {
      const error = new Error("scheduledBefore must be a valid date.");
      error.statusCode = 400;
      error.code = "INVALID_SCHEDULED_BEFORE";
      throw error;
    }

    const limit = positiveInteger(request.query.limit, 100, 1000);
    const scope = communicationAggregateAuthorityFilter(request.communicationScope);
    const campaigns = await CommunicationCampaign.find(
      combine(scope, {
        status: "scheduled",
        "schedule.mode": "scheduled",
        "schedule.scheduledAt": { $lte: scheduledBefore },
      })
    )
      .sort({ "schedule.scheduledAt": 1 })
      .limit(limit)
      .lean({ virtuals: true });

    return response.status(200).json({
      success: true,
      message: "Due scheduled communications retrieved successfully.",
      count: campaigns.length,
      campaigns,
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  getScopedScheduledCommunicationOverview,
  listScopedDueScheduledCommunications,
  listScopedScheduledCommunications,
};
