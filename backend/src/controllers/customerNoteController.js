import {
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
} from "../services/customerNoteService.js";

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

  if (typeof value === "boolean") {
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
      "pending",
      "incomplete",
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

function createControllerError(
  message,
  {
    statusCode = 400,
    code =
      "CUSTOMER_NOTE_REQUEST_ERROR",
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

function getAuthenticatedUser(
  request
) {
  return request.user || null;
}

function getAuthenticatedUserId(
  request
) {
  return (
    request.user?._id ||
    request.user?.id ||
    null
  );
}

function getAuthenticatedUserRole(
  request
) {
  return normaliseLowercase(
    request.user?.role
  );
}

function isAdministrator(
  request
) {
  return (
    getAuthenticatedUserRole(
      request
    ) === "admin"
  );
}

function getCustomerId(request) {
  const customerId =
    normaliseText(
      request.params
        ?.customerId
    );

  if (!customerId) {
    throw createControllerError(
      "A customer ID is required.",
      {
        code:
          "CUSTOMER_ID_REQUIRED",
        field: "customerId",
      }
    );
  }

  return customerId;
}

function getNoteId(request) {
  const noteId =
    normaliseText(
      request.params?.noteId
    );

  if (!noteId) {
    throw createControllerError(
      "A customer note ID is required.",
      {
        code:
          "CUSTOMER_NOTE_ID_REQUIRED",
        field: "noteId",
      }
    );
  }

  return noteId;
}

function normaliseTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((tag) =>
        normaliseText(tag)
      )
      .filter(Boolean);
  }

  const text =
    normaliseText(value);

  if (!text) {
    return [];
  }

  return text
    .split(",")
    .map((tag) =>
      tag.trim()
    )
    .filter(Boolean);
}

function buildNoteListFilters(
  request
) {
  const query =
    request.query || {};

  return {
    page:
      normaliseInteger(
        query.page,
        1,
        1,
        1000000
      ),

    limit:
      normaliseInteger(
        query.limit,
        20,
        1,
        100
      ),

    search:
      normaliseText(
        query.search
      ),

    type:
      normaliseLowercase(
        query.type
      ),

    visibility:
      normaliseLowercase(
        query.visibility
      ),

    tags:
      normaliseTags(
        query.tags
      ),

    pinned:
      query.pinned,

    requiresFollowUp:
      query.requiresFollowUp,

    followUpCompleted:
      query.followUpCompleted,

    overdueOnly:
      query.overdueOnly,

    upcomingOnly:
      query.upcomingOnly,

    createdBy:
      normaliseText(
        query.createdBy
      ),

    stylist:
      normaliseText(
        query.stylist
      ),

    service:
      normaliseText(
        query.service
      ),

    appointment:
      normaliseText(
        query.appointment
      ),

    dateFrom:
      normaliseText(
        query.dateFrom
      ),

    dateTo:
      normaliseText(
        query.dateTo
      ),

    sortBy:
      normaliseText(
        query.sortBy
      ) || "createdAt",

    sortDirection:
      normaliseLowercase(
        query.sortDirection
      ) || "desc",

    includeDeleted:
      isAdministrator(request) &&
      normaliseBoolean(
        query.includeDeleted,
        false
      ),

    includeDeletedCustomer:
      isAdministrator(request) &&
      normaliseBoolean(
        query
          .includeDeletedCustomer,
        false
      ),
  };
}

function serialiseDocument(
  document
) {
  if (!document) {
    return null;
  }

  if (
    typeof document.toJSON ===
    "function"
  ) {
    return document.toJSON();
  }

  return document;
}

/*
|--------------------------------------------------------------------------
| Note collection
|--------------------------------------------------------------------------
*/

async function createNote(
  request,
  response,
  next
) {
  try {
    const note =
      await createCustomerNote(
        getCustomerId(request),
        request.body || {},
        {
          createdBy:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(201)
      .json({
        success: true,

        message:
          "Customer note created successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function listNotes(
  request,
  response,
  next
) {
  try {
    const result =
      await listCustomerNotes(
        getCustomerId(request),
        buildNoteListFilters(
          request
        ),
        {
          viewer:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer notes retrieved successfully.",

        notes:
          result.notes.map(
            serialiseDocument
          ),

        pagination:
          result.pagination,

        filters:
          result.filters,
      });
  } catch (error) {
    return next(error);
  }
}

async function getNoteStatistics(
  request,
  response,
  next
) {
  try {
    const statistics =
      await getCustomerNoteStatistics(
        getCustomerId(request),
        {
          viewer:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer note statistics retrieved successfully.",

        statistics,
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Individual note retrieval and editing
|--------------------------------------------------------------------------
*/

async function getNote(
  request,
  response,
  next
) {
  try {
    const note =
      await findCustomerNote(
        getNoteId(request),
        {
          actor:
            getAuthenticatedUser(
              request
            ),

          includeDeleted:
            isAdministrator(
              request
            ) &&
            normaliseBoolean(
              request.query
                ?.includeDeleted,
              false
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer note retrieved successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function updateNote(
  request,
  response,
  next
) {
  try {
    const note =
      await updateCustomerNote(
        getNoteId(request),
        request.body || {},
        {
          updatedBy:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer note updated successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Pinning
|--------------------------------------------------------------------------
*/

async function updatePinnedStatus(
  request,
  response,
  next
) {
  try {
    if (
      request.body?.pinned ===
      undefined
    ) {
      throw createControllerError(
        "The pinned status is required.",
        {
          code:
            "CUSTOMER_NOTE_PINNED_STATUS_REQUIRED",
          field: "pinned",
        }
      );
    }

    const pinned =
      normaliseBoolean(
        request.body.pinned,
        false
      );

    const note =
      await setCustomerNotePinned(
        getNoteId(request),
        pinned,
        {
          updatedBy:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message: pinned
          ? "Customer note pinned successfully."
          : "Customer note unpinned successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Follow-up management
|--------------------------------------------------------------------------
*/

async function completeFollowUp(
  request,
  response,
  next
) {
  try {
    const note =
      await completeCustomerNoteFollowUp(
        getNoteId(request),
        {
          completedBy:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer note follow-up completed successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function reopenFollowUp(
  request,
  response,
  next
) {
  try {
    const note =
      await reopenCustomerNoteFollowUp(
        getNoteId(request),
        {
          reopenedBy:
            getAuthenticatedUser(
              request
            ),

          followUpAt:
            request.body
              ?.followUpAt,
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer note follow-up reopened successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Soft deletion and restoration
|--------------------------------------------------------------------------
*/

async function deleteNote(
  request,
  response,
  next
) {
  try {
    const note =
      await softDeleteCustomerNote(
        getNoteId(request),
        {
          deletedBy:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer note deleted successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function restoreNote(
  request,
  response,
  next
) {
  try {
    if (
      !isAdministrator(
        request
      )
    ) {
      throw createControllerError(
        "Only an administrator can restore a deleted customer note.",
        {
          statusCode: 403,
          code:
            "ADMINISTRATOR_REQUIRED",
        }
      );
    }

    const note =
      await restoreCustomerNote(
        getNoteId(request),
        {
          restoredBy:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer note restored successfully.",

        note:
          serialiseDocument(
            note
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Customer profile tag management
|--------------------------------------------------------------------------
*/

async function replaceTags(
  request,
  response,
  next
) {
  try {
    const tags =
      normaliseTags(
        request.body?.tags
      );

    const customer =
      await replaceCustomerTags(
        getCustomerId(request),
        tags,
        {
          updatedBy:
            getAuthenticatedUserId(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer tags replaced successfully.",

        customer:
          serialiseDocument(
            customer
          ),

        tags:
          customer.tags || [],
      });
  } catch (error) {
    return next(error);
  }
}

async function addTags(
  request,
  response,
  next
) {
  try {
    const tags =
      normaliseTags(
        request.body?.tags
      );

    if (tags.length === 0) {
      throw createControllerError(
        "At least one customer tag is required.",
        {
          code:
            "CUSTOMER_TAG_REQUIRED",
          field: "tags",
        }
      );
    }

    const customer =
      await addCustomerTags(
        getCustomerId(request),
        tags,
        {
          updatedBy:
            getAuthenticatedUserId(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer tags added successfully.",

        customer:
          serialiseDocument(
            customer
          ),

        tags:
          customer.tags || [],
      });
  } catch (error) {
    return next(error);
  }
}

async function removeTags(
  request,
  response,
  next
) {
  try {
    const tags =
      normaliseTags(
        request.body?.tags
      );

    if (tags.length === 0) {
      throw createControllerError(
        "At least one customer tag is required.",
        {
          code:
            "CUSTOMER_TAG_REQUIRED",
          field: "tags",
        }
      );
    }

    const customer =
      await removeCustomerTags(
        getCustomerId(request),
        tags,
        {
          updatedBy:
            getAuthenticatedUserId(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer tags removed successfully.",

        customer:
          serialiseDocument(
            customer
          ),

        tags:
          customer.tags || [],
      });
  } catch (error) {
    return next(error);
  }
}

async function getTagSummary(
  request,
  response,
  next
) {
  try {
    const tags =
      await getCustomerTagSummary({
        search:
          normaliseText(
            request.query?.search
          ),

        limit:
          normaliseInteger(
            request.query?.limit,
            100,
            1,
            500
          ),
      });

    return response
      .status(200)
      .json({
        success: true,

        message:
          "Customer tag summary retrieved successfully.",

        tags,
      });
  } catch (error) {
    return next(error);
  }
}

export {
  addTags,
  completeFollowUp,
  createNote,
  deleteNote,
  getNote,
  getNoteStatistics,
  getTagSummary,
  listNotes,
  removeTags,
  reopenFollowUp,
  replaceTags,
  restoreNote,
  updateNote,
  updatePinnedStatus,
};