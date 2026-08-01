import mongoose from "mongoose";

import CustomerNote from "../models/CustomerNote.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAXIMUM_LIMIT = 100;

const FOLLOW_UP_POPULATE_OPTIONS = [
  {
    path: "customer",
    select:
      "firstName lastName preferredName email phone photo status tags",
  },
  {
    path: "appointment",
    select:
      "appointmentDate appointmentTime startsAt endsAt status service stylist",
  },
  {
    path: "service",
    select:
      "name category price duration active",
  },
  {
    path: "stylist",
    select:
      "name firstName lastName email phone status isActive",
  },
  {
    path: "createdBy",
    select:
      "name email role",
  },
  {
    path: "updatedBy",
    select:
      "name email role",
  },
  {
    path: "followUpCompletedBy",
    select:
      "name email role",
  },
];

function createFollowUpError(
  message,
  {
    statusCode = 400,
    code = "CUSTOMER_FOLLOW_UP_ERROR",
    field = null,
    details = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.field = field;
  error.details = details;

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(value).toLowerCase();
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsedValue = Number.parseInt(
    value,
    10
  );

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, parsedValue)
  );
}

function getActorId(actor) {
  const actorId =
    actor?._id || actor?.id || actor || null;

  return mongoose.isValidObjectId(actorId)
    ? String(actorId)
    : null;
}

function getActorRole(actor) {
  return normaliseLowercase(actor?.role);
}

function assertValidObjectId(
  value,
  fieldName = "identifier"
) {
  if (!mongoose.isValidObjectId(value)) {
    throw createFollowUpError(
      `${fieldName} must be a valid identifier.`,
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_FOLLOW_UP_IDENTIFIER",
        field: fieldName,
      }
    );
  }
}

function parseRequiredDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createFollowUpError(
      "A valid follow-up date and time is required.",
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_FOLLOW_UP_DATE",
        field: "followUpAt",
      }
    );
  }

  return date;
}

function escapeRegularExpression(value) {
  return normaliseText(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function buildVisibilityQuery(viewer) {
  const viewerId = getActorId(viewer);
  const viewerRole = getActorRole(viewer);

  if (viewerRole === "admin") {
    return {};
  }

  if (!viewerId) {
    return {
      visibility: {
        $ne: "private",
      },
    };
  }

  return {
    $or: [
      {
        visibility: {
          $ne: "private",
        },
      },
      {
        visibility: "private",
        createdBy: viewerId,
      },
    ],
  };
}

function assertFollowUpEditableByActor(
  note,
  actor
) {
  if (note.visibility !== "private") {
    return;
  }

  const actorId = getActorId(actor);
  const actorRole = getActorRole(actor);

  const isAuthor =
    actorId &&
    String(note.createdBy?._id || note.createdBy) ===
      String(actorId);

  if (actorRole !== "admin" && !isAuthor) {
    throw createFollowUpError(
      "Only the note author or an administrator can change this private follow-up.",
      {
        statusCode: 403,
        code:
          "CUSTOMER_FOLLOW_UP_EDIT_DENIED",
      }
    );
  }
}

function buildStateQuery(state, now) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  switch (normaliseLowercase(state)) {
    case "overdue":
      return {
        requiresFollowUp: true,
        followUpCompleted: false,
        followUpAt: {
          $ne: null,
          $lt: now,
        },
      };

    case "due_today":
      return {
        requiresFollowUp: true,
        followUpCompleted: false,
        followUpAt: {
          $gte: todayStart,
          $lte: todayEnd,
        },
      };

    case "upcoming":
      return {
        requiresFollowUp: true,
        followUpCompleted: false,
        followUpAt: {
          $gt: todayEnd,
        },
      };

    case "unscheduled":
      return {
        requiresFollowUp: true,
        followUpCompleted: false,
        followUpAt: null,
      };

    case "completed":
      return {
        requiresFollowUp: true,
        followUpCompleted: true,
      };

    case "all":
      return {
        requiresFollowUp: true,
      };

    case "open":
    default:
      return {
        requiresFollowUp: true,
        followUpCompleted: false,
      };
  }
}

function buildFollowUpQuery(
  filters,
  viewer,
  now
) {
  const query = {
    deletedAt: null,
    ...buildStateQuery(filters.state, now),
    ...buildVisibilityQuery(viewer),
  };

  const search = normaliseText(filters.search);

  if (search) {
    const expression = new RegExp(
      escapeRegularExpression(search),
      "i"
    );

    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          {
            title: expression,
          },
          {
            content: expression,
          },
          {
            tags: expression,
          },
          {
            type: expression,
          },
        ],
      },
    ];
  }

  const customerId = normaliseText(
    filters.customerId
  );

  if (customerId) {
    assertValidObjectId(
      customerId,
      "customerId"
    );

    query.customer = customerId;
  }

  const noteType = normaliseLowercase(
    filters.type
  );

  if (noteType) {
    query.type = noteType;
  }

  return query;
}

function serialiseFollowUp(note, now = new Date()) {
  const followUpAt = note.followUpAt
    ? new Date(note.followUpAt)
    : null;

  const isOverdue = Boolean(
    note.requiresFollowUp &&
      !note.followUpCompleted &&
      followUpAt &&
      followUpAt < now
  );

  return {
    id: note._id,
    customer: note.customer,
    appointment: note.appointment,
    service: note.service,
    stylist: note.stylist,
    title: note.title,
    content: note.content,
    type: note.type,
    visibility: note.visibility,
    tags: note.tags || [],
    pinned: Boolean(note.pinned),
    requiresFollowUp: Boolean(
      note.requiresFollowUp
    ),
    followUpAt: note.followUpAt,
    followUpCompleted: Boolean(
      note.followUpCompleted
    ),
    followUpCompletedAt:
      note.followUpCompletedAt,
    followUpCompletedBy:
      note.followUpCompletedBy,
    createdBy: note.createdBy,
    updatedBy: note.updatedBy,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    isOverdue,
  };
}

async function listCustomerFollowUps(
  filters = {},
  {
    viewer = null,
  } = {}
) {
  const now = new Date();

  const page = normaliseInteger(
    filters.page,
    DEFAULT_PAGE,
    1,
    1000000
  );

  const limit = normaliseInteger(
    filters.limit,
    DEFAULT_LIMIT,
    1,
    MAXIMUM_LIMIT
  );

  const state =
    normaliseLowercase(filters.state) ||
    "open";

  const query = buildFollowUpQuery(
    {
      ...filters,
      state,
    },
    viewer,
    now
  );

  const sort =
    state === "completed"
      ? {
          followUpCompletedAt: -1,
          updatedAt: -1,
          _id: -1,
        }
      : {
          followUpAt: 1,
          pinned: -1,
          createdAt: 1,
          _id: 1,
        };

  const [notes, total] = await Promise.all([
    CustomerNote.find(query)
      .populate(FOLLOW_UP_POPULATE_OPTIONS)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    CustomerNote.countDocuments(query),
  ]);

  const pages = Math.max(
    1,
    Math.ceil(total / limit)
  );

  return {
    followUps: notes.map((note) =>
      serialiseFollowUp(note, now)
    ),

    pagination: {
      page,
      limit,
      total,
      pages,
      hasPreviousPage: page > 1,
      hasNextPage: page < pages,
    },

    filters: {
      state,
      search: normaliseText(filters.search),
      customerId: normaliseText(
        filters.customerId
      ),
      type: normaliseLowercase(
        filters.type
      ),
    },
  };
}

async function getCustomerFollowUpSummary({
  viewer = null,
} = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const visibilityQuery =
    buildVisibilityQuery(viewer);

  const baseQuery = {
    deletedAt: null,
    requiresFollowUp: true,
    ...visibilityQuery,
  };

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(
    thirtyDaysAgo.getDate() - 30
  );

  const [
    open,
    overdue,
    dueToday,
    upcoming,
    unscheduled,
    completedLast30Days,
  ] = await Promise.all([
    CustomerNote.countDocuments({
      ...baseQuery,
      followUpCompleted: false,
    }),

    CustomerNote.countDocuments({
      ...baseQuery,
      followUpCompleted: false,
      followUpAt: {
        $ne: null,
        $lt: now,
      },
    }),

    CustomerNote.countDocuments({
      ...baseQuery,
      followUpCompleted: false,
      followUpAt: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    }),

    CustomerNote.countDocuments({
      ...baseQuery,
      followUpCompleted: false,
      followUpAt: {
        $gt: todayEnd,
      },
    }),

    CustomerNote.countDocuments({
      ...baseQuery,
      followUpCompleted: false,
      followUpAt: null,
    }),

    CustomerNote.countDocuments({
      ...baseQuery,
      followUpCompleted: true,
      followUpCompletedAt: {
        $gte: thirtyDaysAgo,
      },
    }),
  ]);

  return {
    generatedAt: now,
    open,
    overdue,
    dueToday,
    upcoming,
    unscheduled,
    completedLast30Days,
  };
}

async function scheduleCustomerFollowUp(
  noteId,
  followUpAt,
  {
    actor = null,
  } = {}
) {
  assertValidObjectId(noteId, "noteId");

  const actorId = getActorId(actor);

  if (!actorId) {
    throw createFollowUpError(
      "An authenticated staff member is required.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_FOLLOW_UP_ACTOR_REQUIRED",
      }
    );
  }

  const date = parseRequiredDate(followUpAt);

  const note = await CustomerNote.findOne({
    _id: noteId,
    deletedAt: null,
  });

  if (!note) {
    throw createFollowUpError(
      "Customer follow-up not found.",
      {
        statusCode: 404,
        code:
          "CUSTOMER_FOLLOW_UP_NOT_FOUND",
      }
    );
  }

  assertFollowUpEditableByActor(note, actor);

  note.requiresFollowUp = true;
  note.followUpCompleted = false;
  note.followUpAt = date;
  note.followUpCompletedAt = null;
  note.followUpCompletedBy = null;
  note.updatedBy = actorId;
  note.isEdited = true;
  note.editedAt = new Date();

  await note.save();
  await note.populate(
    FOLLOW_UP_POPULATE_OPTIONS
  );

  return serialiseFollowUp(
    note.toObject(),
    new Date()
  );
}

export {
  createFollowUpError,
  getCustomerFollowUpSummary,
  listCustomerFollowUps,
  scheduleCustomerFollowUp,
};

export default {
  getCustomerFollowUpSummary,
  listCustomerFollowUps,
  scheduleCustomerFollowUp,
};
