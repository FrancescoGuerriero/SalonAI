import mongoose from "mongoose";

import Customer from "../models/customer.js";

import CustomerNote, {
  CUSTOMER_NOTE_TYPES,
  CUSTOMER_NOTE_VISIBILITIES,
} from "../models/CustomerNote.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAXIMUM_LIMIT = 100;

const NOTE_SORT_FIELDS = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  followUpAt: "followUpAt",
  title: "title",
  type: "type",
  pinned: "pinned",
};

const NOTE_POPULATE_OPTIONS = [
  {
    path: "customer",
    select:
      "firstName lastName preferredName email phone photo status tags",
  },
  {
    path: "appointment",
    select:
      "appointmentDate appointmentTime status customer service stylist",
  },
  {
    path: "service",
    select:
      "name category price duration active",
  },
  {
    path: "stylist",
    select:
      "name firstName lastName email phone status",
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
  {
    path: "deletedBy",
    select:
      "name email role",
  },
];

const PROTECTED_NOTE_FIELDS =
  new Set([
    "_id",
    "id",
    "__v",
    "customer",
    "createdBy",
    "createdAt",
    "updatedAt",
    "updatedBy",
    "isEdited",
    "editedAt",
    "deletedAt",
    "deletedBy",
    "followUpCompletedAt",
    "followUpCompletedBy",
  ]);

function createCustomerNoteError(
  message,
  {
    statusCode = 400,
    code = "CUSTOMER_NOTE_ERROR",
    field = null,
    details = null,
    cause = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.field = field;
  error.details = details;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(
    value
  ).toLowerCase();
}

function normaliseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const normalisedValue =
    normaliseLowercase(value);

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
      "complete",
      "completed",
    ].includes(normalisedValue)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "disabled",
      "incomplete",
      "pending",
    ].includes(normalisedValue)
  ) {
    return false;
  }

  return fallback;
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsedValue
    )
  );
}

function normaliseNumber(
  value,
  fallback = 0,
  minimum = 0
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return fallback;
  }

  return Math.max(
    minimum,
    parsedValue
  );
}

function normaliseObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return {
    ...value,
  };
}

function normaliseStringArray(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  const values =
    Array.isArray(value)
      ? value
      : normaliseText(value)
          .split(",");

  return Array.from(
    new Set(
      values
        .map((entry) =>
          normaliseText(entry)
        )
        .filter(Boolean)
    )
  );
}

function normaliseTagArray(value) {
  return normaliseStringArray(
    value
  ).map((tag) =>
    tag.toLowerCase()
  );
}

function parseOptionalDate(
  value,
  fieldName
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsedDate =
    new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw createCustomerNoteError(
      `${fieldName} must be a valid date.`,
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_NOTE_DATE",
        field: fieldName,
      }
    );
  }

  return parsedDate;
}

function assertValidObjectId(
  value,
  fieldName = "identifier"
) {
  if (
    !mongoose.isValidObjectId(
      value
    )
  ) {
    throw createCustomerNoteError(
      `${fieldName} must be a valid identifier.`,
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_NOTE_IDENTIFIER",
        field: fieldName,
      }
    );
  }
}

function getActorId(actor) {
  const actorId =
    actor?._id ||
    actor?.id ||
    actor ||
    null;

  return mongoose.isValidObjectId(
    actorId
  )
    ? actorId
    : null;
}

function getActorRole(actor) {
  return normaliseLowercase(
    actor?.role
  );
}

function escapeRegularExpression(
  value
) {
  return normaliseText(
    value
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function stripProtectedFields(
  payload
) {
  return Object.fromEntries(
    Object.entries(
      normaliseObject(payload)
    ).filter(
      ([field]) =>
        !PROTECTED_NOTE_FIELDS.has(
          field
        )
    )
  );
}

function normaliseAttachment(
  attachment
) {
  const supplied =
    normaliseObject(
      attachment
    );

  const name =
    normaliseText(
      supplied.name
    );

  const url =
    normaliseText(
      supplied.url
    );

  if (!name || !url) {
    throw createCustomerNoteError(
      "Each attachment requires a name and URL.",
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_NOTE_ATTACHMENT",
        field: "attachments",
      }
    );
  }

  return {
    name,

    url,

    mimeType:
      normaliseText(
        supplied.mimeType
      ),

    sizeBytes:
      normaliseNumber(
        supplied.sizeBytes,
        0,
        0
      ),

    uploadedAt:
      parseOptionalDate(
        supplied.uploadedAt,
        "attachments.uploadedAt"
      ) || new Date(),
  };
}

function normaliseAttachments(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createCustomerNoteError(
      "Attachments must be supplied as an array.",
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_NOTE_ATTACHMENTS",
        field: "attachments",
      }
    );
  }

  return value.map(
    normaliseAttachment
  );
}

function normaliseReference(
  value,
  fieldName
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const identifier =
    value?._id ||
    value?.id ||
    value;

  assertValidObjectId(
    identifier,
    fieldName
  );

  return identifier;
}

function assertSupportedNoteType(
  value
) {
  const type =
    normaliseLowercase(value) ||
    "general";

  if (
    !CUSTOMER_NOTE_TYPES.includes(
      type
    )
  ) {
    throw createCustomerNoteError(
      `Unsupported customer note type: ${type}.`,
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_NOTE_TYPE",
        field: "type",
      }
    );
  }

  return type;
}

function assertSupportedVisibility(
  value
) {
  const visibility =
    normaliseLowercase(value) ||
    "staff";

  if (
    !CUSTOMER_NOTE_VISIBILITIES.includes(
      visibility
    )
  ) {
    throw createCustomerNoteError(
      `Unsupported customer note visibility: ${visibility}.`,
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_NOTE_VISIBILITY",
        field: "visibility",
      }
    );
  }

  return visibility;
}

function normaliseNotePayload(
  payload,
  {
    partial = false,
    currentNote = null,
  } = {}
) {
  const supplied =
    stripProtectedFields(
      payload
    );

  const result = {};

  if (
    !partial ||
    supplied.title !== undefined
  ) {
    result.title =
      normaliseText(
        supplied.title
      );
  }

  if (
    !partial ||
    supplied.content !==
      undefined
  ) {
    result.content =
      normaliseText(
        supplied.content
      );
  }

  if (
    !partial ||
    supplied.type !== undefined
  ) {
    result.type =
      assertSupportedNoteType(
        supplied.type
      );
  }

  if (
    !partial ||
    supplied.visibility !==
      undefined
  ) {
    result.visibility =
      assertSupportedVisibility(
        supplied.visibility
      );
  }

  if (
    supplied.tags !== undefined
  ) {
    result.tags =
      normaliseTagArray(
        supplied.tags
      );
  }

  if (
    supplied.appointment !==
      undefined
  ) {
    result.appointment =
      normaliseReference(
        supplied.appointment,
        "appointment"
      );
  }

  if (
    supplied.service !==
      undefined
  ) {
    result.service =
      normaliseReference(
        supplied.service,
        "service"
      );
  }

  if (
    supplied.stylist !==
      undefined
  ) {
    result.stylist =
      normaliseReference(
        supplied.stylist,
        "stylist"
      );
  }

  if (
    supplied.pinned !==
      undefined
  ) {
    result.pinned =
      normaliseBoolean(
        supplied.pinned,
        currentNote?.pinned ||
          false
      );
  }

  if (
    supplied.requiresFollowUp !==
      undefined
  ) {
    result.requiresFollowUp =
      normaliseBoolean(
        supplied.requiresFollowUp,
        currentNote
          ?.requiresFollowUp ||
          false
      );
  }

  if (
    supplied.followUpAt !==
      undefined
  ) {
    result.followUpAt =
      parseOptionalDate(
        supplied.followUpAt,
        "followUpAt"
      );
  }

  if (
    supplied.followUpCompleted !==
      undefined
  ) {
    result.followUpCompleted =
      normaliseBoolean(
        supplied.followUpCompleted,
        currentNote
          ?.followUpCompleted ||
          false
      );
  }

  if (
    supplied.attachments !==
      undefined
  ) {
    result.attachments =
      normaliseAttachments(
        supplied.attachments
      );
  }

  return result;
}

async function assertCustomerExists(
  customerId,
  {
    includeDeleted = false,
  } = {}
) {
  assertValidObjectId(
    customerId,
    "customerId"
  );

  const query = {
    _id: customerId,
  };

  if (!includeDeleted) {
    query.status = {
      $ne: "deleted",
    };
  }

  const customer =
    await Customer.findOne(
      query
    );

  if (!customer) {
    throw createCustomerNoteError(
      "Customer profile not found.",
      {
        statusCode: 404,
        code:
          "CUSTOMER_PROFILE_NOT_FOUND",
      }
    );
  }

  return customer;
}

function buildVisibilityQuery(
  viewer
) {
  const viewerId =
    getActorId(viewer);

  const viewerRole =
    getActorRole(viewer);

  if (
    viewerRole === "admin"
  ) {
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

function assertNoteVisibleToActor(
  note,
  actor
) {
  if (
    note.visibility !== "private"
  ) {
    return;
  }

  const actorId =
    getActorId(actor);

  const actorRole =
    getActorRole(actor);

  const isAuthor =
    actorId &&
    String(note.createdBy?._id ||
      note.createdBy) ===
      String(actorId);

  if (
    actorRole !== "admin" &&
    !isAuthor
  ) {
    throw createCustomerNoteError(
      "You do not have permission to access this private customer note.",
      {
        statusCode: 403,
        code:
          "CUSTOMER_NOTE_ACCESS_DENIED",
      }
    );
  }
}

function assertNoteEditableByActor(
  note,
  actor
) {
  assertNoteVisibleToActor(
    note,
    actor
  );

  const actorId =
    getActorId(actor);

  const actorRole =
    getActorRole(actor);

  if (
    note.visibility !==
      "private"
  ) {
    return;
  }

  const isAuthor =
    actorId &&
    String(note.createdBy?._id ||
      note.createdBy) ===
      String(actorId);

  if (
    actorRole !== "admin" &&
    !isAuthor
  ) {
    throw createCustomerNoteError(
      "Only the author or an administrator can modify this private note.",
      {
        statusCode: 403,
        code:
          "CUSTOMER_NOTE_EDIT_DENIED",
      }
    );
  }
}

async function populateCustomerNote(
  note
) {
  if (!note) {
    return null;
  }

  await note.populate(
    NOTE_POPULATE_OPTIONS
  );

  return note;
}

async function createCustomerNote(
  customerId,
  payload,
  {
    createdBy,
  } = {}
) {
  const actorId =
    getActorId(createdBy);

  if (!actorId) {
    throw createCustomerNoteError(
      "An authenticated note author is required.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_NOTE_AUTHOR_REQUIRED",
      }
    );
  }

  await assertCustomerExists(
    customerId
  );

  const noteData =
    normaliseNotePayload(
      payload,
      {
        partial: false,
      }
    );

  if (!noteData.content) {
    throw createCustomerNoteError(
      "Customer note content is required.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_NOTE_CONTENT_REQUIRED",
        field: "content",
      }
    );
  }

  if (
    noteData.requiresFollowUp &&
    !noteData.followUpAt
  ) {
    throw createCustomerNoteError(
      "A follow-up date is required when follow-up is enabled.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_NOTE_FOLLOW_UP_DATE_REQUIRED",
        field: "followUpAt",
      }
    );
  }

  const note =
    await CustomerNote.create({
      ...noteData,
      customer: customerId,
      createdBy: actorId,
      updatedBy: actorId,
    });

  return populateCustomerNote(
    note
  );
}

function buildCustomerNoteQuery(
  customerId,
  filters = {},
  viewer = null
) {
  assertValidObjectId(
    customerId,
    "customerId"
  );

  const supplied =
    normaliseObject(filters);

  const query = {
    customer: customerId,
    ...buildVisibilityQuery(
      viewer
    ),
  };

  const includeDeleted =
    normaliseBoolean(
      supplied.includeDeleted,
      false
    );

  if (!includeDeleted) {
    query.deletedAt = null;
  }

  const type =
    normaliseLowercase(
      supplied.type
    );

  if (type) {
    query.type =
      assertSupportedNoteType(
        type
      );
  }

  const visibility =
    normaliseLowercase(
      supplied.visibility
    );

  if (visibility) {
    query.visibility =
      assertSupportedVisibility(
        visibility
      );
  }

  if (
    supplied.pinned !==
    undefined
  ) {
    query.pinned =
      normaliseBoolean(
        supplied.pinned,
        false
      );
  }

  if (
    supplied.requiresFollowUp !==
    undefined
  ) {
    query.requiresFollowUp =
      normaliseBoolean(
        supplied.requiresFollowUp,
        false
      );
  }

  if (
    supplied.followUpCompleted !==
    undefined
  ) {
    query.followUpCompleted =
      normaliseBoolean(
        supplied.followUpCompleted,
        false
      );
  }

  if (
    normaliseBoolean(
      supplied.overdueOnly,
      false
    )
  ) {
    query.requiresFollowUp = true;
    query.followUpCompleted = false;

    query.followUpAt = {
      $ne: null,
      $lt: new Date(),
    };
  }

  if (
    normaliseBoolean(
      supplied.upcomingOnly,
      false
    )
  ) {
    query.requiresFollowUp = true;
    query.followUpCompleted = false;

    query.followUpAt = {
      $ne: null,
      $gte: new Date(),
    };
  }

  if (supplied.createdBy) {
    assertValidObjectId(
      supplied.createdBy,
      "createdBy"
    );

    query.createdBy =
      supplied.createdBy;
  }

  if (supplied.stylist) {
    assertValidObjectId(
      supplied.stylist,
      "stylist"
    );

    query.stylist =
      supplied.stylist;
  }

  if (supplied.service) {
    assertValidObjectId(
      supplied.service,
      "service"
    );

    query.service =
      supplied.service;
  }

  if (supplied.appointment) {
    assertValidObjectId(
      supplied.appointment,
      "appointment"
    );

    query.appointment =
      supplied.appointment;
  }

  const tags =
    normaliseTagArray(
      supplied.tags
    );

  if (tags.length > 0) {
    query.tags = {
      $all: tags,
    };
  }

  const search =
    normaliseText(
      supplied.search
    );

  if (search) {
    const expression =
      new RegExp(
        escapeRegularExpression(
          search
        ),
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
        ],
      },
    ];
  }

  const dateFrom =
    supplied.dateFrom
      ? parseOptionalDate(
          supplied.dateFrom,
          "dateFrom"
        )
      : null;

  const dateTo =
    supplied.dateTo
      ? parseOptionalDate(
          supplied.dateTo,
          "dateTo"
        )
      : null;

  if (dateFrom || dateTo) {
    query.createdAt = {};

    if (dateFrom) {
      query.createdAt.$gte =
        dateFrom;
    }

    if (dateTo) {
      const inclusiveEnd =
        new Date(dateTo);

      inclusiveEnd.setHours(
        23,
        59,
        59,
        999
      );

      query.createdAt.$lte =
        inclusiveEnd;
    }
  }

  return query;
}

async function listCustomerNotes(
  customerId,
  filters = {},
  {
    viewer = null,
  } = {}
) {
  await assertCustomerExists(
    customerId,
    {
      includeDeleted:
        normaliseBoolean(
          filters.includeDeletedCustomer,
          false
        ),
    }
  );

  const page =
    normaliseInteger(
      filters.page,
      DEFAULT_PAGE,
      1,
      1000000
    );

  const limit =
    normaliseInteger(
      filters.limit,
      DEFAULT_LIMIT,
      1,
      MAXIMUM_LIMIT
    );

  const sortField =
    NOTE_SORT_FIELDS[
      filters.sortBy
    ] ||
    "createdAt";

  const sortDirection =
    normaliseLowercase(
      filters.sortDirection
    ) === "asc"
      ? 1
      : -1;

  const query =
    buildCustomerNoteQuery(
      customerId,
      filters,
      viewer
    );

  const sort = {
    pinned: -1,
    [sortField]:
      sortDirection,
    _id: sortDirection,
  };

  if (sortField === "pinned") {
    delete sort.pinned;

    sort.pinned =
      sortDirection;
  }

  const [
    notes,
    total,
  ] = await Promise.all([
    CustomerNote.find(query)
      .populate(
        NOTE_POPULATE_OPTIONS
      )
      .sort(sort)
      .skip(
        (page - 1) *
          limit
      )
      .limit(limit),

    CustomerNote.countDocuments(
      query
    ),
  ]);

  const pages =
    Math.max(
      1,
      Math.ceil(
        total / limit
      )
    );

  return {
    notes,

    pagination: {
      page,
      limit,
      total,
      pages,

      hasPreviousPage:
        page > 1,

      hasNextPage:
        page < pages,
    },

    filters: {
      search:
        normaliseText(
          filters.search
        ),

      type:
        normaliseLowercase(
          filters.type
        ),

      visibility:
        normaliseLowercase(
          filters.visibility
        ),

      sortBy: sortField,

      sortDirection:
        sortDirection === 1
          ? "asc"
          : "desc",
    },
  };
}

async function findCustomerNote(
  noteId,
  {
    actor = null,
    includeDeleted = false,
    populate = true,
  } = {}
) {
  assertValidObjectId(
    noteId,
    "noteId"
  );

  const query = {
    _id: noteId,
  };

  if (!includeDeleted) {
    query.deletedAt = null;
  }

  const note =
    await CustomerNote.findOne(
      query
    );

  if (!note) {
    throw createCustomerNoteError(
      "Customer note not found.",
      {
        statusCode: 404,
        code:
          "CUSTOMER_NOTE_NOT_FOUND",
      }
    );
  }

  assertNoteVisibleToActor(
    note,
    actor
  );

  return populate
    ? populateCustomerNote(
        note
      )
    : note;
}

async function updateCustomerNote(
  noteId,
  payload,
  {
    updatedBy,
  } = {}
) {
  const actorId =
    getActorId(updatedBy);

  if (!actorId) {
    throw createCustomerNoteError(
      "An authenticated user is required to update the note.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_NOTE_EDITOR_REQUIRED",
      }
    );
  }

  const note =
    await findCustomerNote(
      noteId,
      {
        actor: updatedBy,
        populate: false,
      }
    );

  assertNoteEditableByActor(
    note,
    updatedBy
  );

  const update =
    normaliseNotePayload(
      payload,
      {
        partial: true,
        currentNote: note,
      }
    );

  if (
    Object.prototype.hasOwnProperty.call(
      update,
      "content"
    ) &&
    !update.content
  ) {
    throw createCustomerNoteError(
      "Customer note content cannot be empty.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_NOTE_CONTENT_REQUIRED",
        field: "content",
      }
    );
  }

  for (
    const [
      field,
      value,
    ] of Object.entries(update)
  ) {
    note.set(
      field,
      value
    );
  }

  if (
    note.requiresFollowUp &&
    !note.followUpAt
  ) {
    throw createCustomerNoteError(
      "A follow-up date is required when follow-up is enabled.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_NOTE_FOLLOW_UP_DATE_REQUIRED",
        field: "followUpAt",
      }
    );
  }

  note.markEdited(
    actorId
  );

  await note.save();

  return populateCustomerNote(
    note
  );
}

async function setCustomerNotePinned(
  noteId,
  pinned,
  {
    updatedBy,
  } = {}
) {
  const actorId =
    getActorId(updatedBy);

  if (!actorId) {
    throw createCustomerNoteError(
      "An authenticated user is required.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_NOTE_USER_REQUIRED",
      }
    );
  }

  const note =
    await findCustomerNote(
      noteId,
      {
        actor: updatedBy,
        populate: false,
      }
    );

  assertNoteEditableByActor(
    note,
    updatedBy
  );

  note.pinned =
    normaliseBoolean(
      pinned,
      false
    );

  note.markEdited(
    actorId
  );

  await note.save();

  return populateCustomerNote(
    note
  );
}

async function completeCustomerNoteFollowUp(
  noteId,
  {
    completedBy,
  } = {}
) {
  const actorId =
    getActorId(
      completedBy
    );

  if (!actorId) {
    throw createCustomerNoteError(
      "An authenticated user is required to complete the follow-up.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_NOTE_USER_REQUIRED",
      }
    );
  }

  const note =
    await findCustomerNote(
      noteId,
      {
        actor: completedBy,
        populate: false,
      }
    );

  assertNoteEditableByActor(
    note,
    completedBy
  );

  if (
    !note.requiresFollowUp
  ) {
    throw createCustomerNoteError(
      "This customer note does not require follow-up.",
      {
        statusCode: 409,
        code:
          "CUSTOMER_NOTE_FOLLOW_UP_NOT_REQUIRED",
      }
    );
  }

  note.completeFollowUp(
    actorId
  );

  note.updatedBy =
    actorId;

  await note.save();

  return populateCustomerNote(
    note
  );
}

async function reopenCustomerNoteFollowUp(
  noteId,
  {
    reopenedBy,
    followUpAt = undefined,
  } = {}
) {
  const actorId =
    getActorId(
      reopenedBy
    );

  if (!actorId) {
    throw createCustomerNoteError(
      "An authenticated user is required to reopen the follow-up.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_NOTE_USER_REQUIRED",
      }
    );
  }

  const note =
    await findCustomerNote(
      noteId,
      {
        actor: reopenedBy,
        populate: false,
      }
    );

  assertNoteEditableByActor(
    note,
    reopenedBy
  );

  note.reopenFollowUp();

  if (
    followUpAt !== undefined
  ) {
    note.followUpAt =
      parseOptionalDate(
        followUpAt,
        "followUpAt"
      );
  }

  if (!note.followUpAt) {
    throw createCustomerNoteError(
      "A follow-up date is required when reopening follow-up.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_NOTE_FOLLOW_UP_DATE_REQUIRED",
        field: "followUpAt",
      }
    );
  }

  note.updatedBy =
    actorId;

  await note.save();

  return populateCustomerNote(
    note
  );
}

async function softDeleteCustomerNote(
  noteId,
  {
    deletedBy,
  } = {}
) {
  const actorId =
    getActorId(deletedBy);

  if (!actorId) {
    throw createCustomerNoteError(
      "An authenticated user is required to delete the note.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_NOTE_USER_REQUIRED",
      }
    );
  }

  const note =
    await findCustomerNote(
      noteId,
      {
        actor: deletedBy,
        populate: false,
      }
    );

  assertNoteEditableByActor(
    note,
    deletedBy
  );

  note.softDelete(
    actorId
  );

  note.updatedBy =
    actorId;

  await note.save();

  return populateCustomerNote(
    note
  );
}

async function restoreCustomerNote(
  noteId,
  {
    restoredBy,
  } = {}
) {
  const actorId =
    getActorId(restoredBy);

  if (!actorId) {
    throw createCustomerNoteError(
      "An authenticated user is required to restore the note.",
      {
        statusCode: 401,
        code:
          "CUSTOMER_NOTE_USER_REQUIRED",
      }
    );
  }

  const note =
    await findCustomerNote(
      noteId,
      {
        actor: restoredBy,
        includeDeleted: true,
        populate: false,
      }
    );

  assertNoteEditableByActor(
    note,
    restoredBy
  );

  if (!note.deletedAt) {
    return populateCustomerNote(
      note
    );
  }

  note.restore();

  note.updatedBy =
    actorId;

  await note.save();

  return populateCustomerNote(
    note
  );
}

/*
|--------------------------------------------------------------------------
| Customer profile tags
|--------------------------------------------------------------------------
*/

async function replaceCustomerTags(
  customerId,
  tags,
  {
    updatedBy,
  } = {}
) {
  const customer =
    await assertCustomerExists(
      customerId
    );

  customer.tags =
    normaliseTagArray(tags);

  customer.updatedBy =
    getActorId(updatedBy);

  await customer.save();

  return customer;
}

async function addCustomerTags(
  customerId,
  tags,
  {
    updatedBy,
  } = {}
) {
  const customer =
    await assertCustomerExists(
      customerId
    );

  const newTags =
    normaliseTagArray(tags);

  customer.tags =
    Array.from(
      new Set([
        ...(customer.tags || []),
        ...newTags,
      ])
    );

  customer.updatedBy =
    getActorId(updatedBy);

  await customer.save();

  return customer;
}

async function removeCustomerTags(
  customerId,
  tags,
  {
    updatedBy,
  } = {}
) {
  const customer =
    await assertCustomerExists(
      customerId
    );

  const tagsToRemove =
    new Set(
      normaliseTagArray(tags)
    );

  customer.tags =
    (customer.tags || []).filter(
      (tag) =>
        !tagsToRemove.has(
          normaliseLowercase(
            tag
          )
        )
    );

  customer.updatedBy =
    getActorId(updatedBy);

  await customer.save();

  return customer;
}

async function getCustomerTagSummary({
  search = "",
  limit = 100,
} = {}) {
  const safeLimit =
    normaliseInteger(
      limit,
      100,
      1,
      500
    );

  const pipeline = [
    {
      $match: {
        status: {
          $ne: "deleted",
        },

        tags: {
          $exists: true,
          $ne: [],
        },
      },
    },

    {
      $unwind: "$tags",
    },
  ];

  const searchValue =
    normaliseText(search);

  if (searchValue) {
    pipeline.push({
      $match: {
        tags: {
          $regex:
            escapeRegularExpression(
              searchValue
            ),

          $options: "i",
        },
      },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: "$tags",

        customerCount: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        customerCount: -1,
        _id: 1,
      },
    },

    {
      $limit: safeLimit,
    },

    {
      $project: {
        _id: 0,
        tag: "$_id",
        customerCount: 1,
      },
    }
  );

  return Customer.aggregate(
    pipeline
  );
}

/*
|--------------------------------------------------------------------------
| Note statistics
|--------------------------------------------------------------------------
*/

async function getCustomerNoteStatistics(
  customerId,
  {
    viewer = null,
  } = {}
) {
  await assertCustomerExists(
    customerId
  );

  const visibilityQuery =
    buildVisibilityQuery(
      viewer
    );

  const match = {
    customer:
      new mongoose.Types.ObjectId(
        customerId
      ),

    deletedAt: null,

    ...visibilityQuery,
  };

  const [
    summary,
    byType,
    commonTags,
  ] = await Promise.all([
    CustomerNote.aggregate([
      {
        $match: match,
      },

      {
        $group: {
          _id: null,

          totalNotes: {
            $sum: 1,
          },

          pinnedNotes: {
            $sum: {
              $cond: [
                "$pinned",
                1,
                0,
              ],
            },
          },

          followUpNotes: {
            $sum: {
              $cond: [
                "$requiresFollowUp",
                1,
                0,
              ],
            },
          },

          completedFollowUps: {
            $sum: {
              $cond: [
                "$followUpCompleted",
                1,
                0,
              ],
            },
          },

          overdueFollowUps: {
            $sum: {
              $cond: [
                {
                  $and: [
                    "$requiresFollowUp",

                    {
                      $eq: [
                        "$followUpCompleted",
                        false,
                      ],
                    },

                    {
                      $ne: [
                        "$followUpAt",
                        null,
                      ],
                    },

                    {
                      $lt: [
                        "$followUpAt",
                        new Date(),
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    CustomerNote.aggregate([
      {
        $match: match,
      },

      {
        $group: {
          _id: "$type",

          total: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          total: -1,
          _id: 1,
        },
      },
    ]),

    CustomerNote.aggregate([
      {
        $match: {
          ...match,

          tags: {
            $exists: true,
            $ne: [],
          },
        },
      },

      {
        $unwind: "$tags",
      },

      {
        $group: {
          _id: "$tags",

          total: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          total: -1,
          _id: 1,
        },
      },

      {
        $limit: 20,
      },

      {
        $project: {
          _id: 0,
          tag: "$_id",
          total: 1,
        },
      },
    ]),
  ]);

  const totals =
    summary[0] || {
      totalNotes: 0,
      pinnedNotes: 0,
      followUpNotes: 0,
      completedFollowUps: 0,
      overdueFollowUps: 0,
    };

  return {
    ...totals,

    pendingFollowUps:
      Math.max(
        0,
        totals.followUpNotes -
          totals.completedFollowUps
      ),

    byType:
      Object.fromEntries(
        byType.map(
          (entry) => [
            entry._id,
            entry.total,
          ]
        )
      ),

    commonTags,
  };
}

export {
  addCustomerTags,
  completeCustomerNoteFollowUp,
  createCustomerNote,
  createCustomerNoteError,
  findCustomerNote,
  getCustomerNoteStatistics,
  getCustomerTagSummary,
  listCustomerNotes,
  removeCustomerTags,
  reopenCustomerNoteFollowUp,
  replaceCustomerTags,
  restoreCustomerNote,
  setCustomerNotePinned,
  softDeleteCustomerNote,
  updateCustomerNote,
};

export default {
  addCustomerTags,
  completeCustomerNoteFollowUp,
  createCustomerNote,
  findCustomerNote,
  getCustomerNoteStatistics,
  getCustomerTagSummary,
  listCustomerNotes,
  removeCustomerTags,
  reopenCustomerNoteFollowUp,
  replaceCustomerTags,
  restoreCustomerNote,
  setCustomerNotePinned,
  softDeleteCustomerNote,
  updateCustomerNote,
};