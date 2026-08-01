import axios from "axios";

const TOKEN_STORAGE_KEY =
  "salonai_token";

const USER_STORAGE_KEY =
  "salonai_user";

const DEFAULT_API_URL =
  "http://localhost:5000/api";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL ||
    DEFAULT_API_URL
).replace(/\/+$/, "");

const customerNoteApi =
  axios.create({
    baseURL: API_BASE_URL,

    timeout: 60000,

    withCredentials: true,

    headers: {
      Accept:
        "application/json",

      "Content-Type":
        "application/json",
    },
  });

function normaliseText(value) {
  return String(
    value ?? ""
  ).trim();
}

function getStoredToken() {
  return normaliseText(
    localStorage.getItem(
      TOKEN_STORAGE_KEY
    )
  );
}

function clearStoredAuthentication() {
  localStorage.removeItem(
    TOKEN_STORAGE_KEY
  );

  localStorage.removeItem(
    USER_STORAGE_KEY
  );
}

function dispatchAuthenticationExpiredEvent() {
  window.dispatchEvent(
    new CustomEvent(
      "salonai:authentication-expired"
    )
  );
}

function createCustomerNoteApiError(
  error
) {
  const responseData =
    error?.response?.data || {};

  const apiError =
    new Error(
      responseData.message ||
        error?.message ||
        "The customer-note request failed."
    );

  apiError.name =
    "CustomerNoteApiError";

  apiError.status =
    error?.response?.status ||
    null;

  apiError.statusCode =
    error?.response?.status ||
    responseData.statusCode ||
    null;

  apiError.code =
    responseData.code ||
    error?.code ||
    "CUSTOMER_NOTE_API_ERROR";

  apiError.field =
    responseData.field ||
    null;

  apiError.details =
    responseData.details ||
    null;

  apiError.data =
    responseData;

  apiError.originalError =
    error;

  return apiError;
}

customerNoteApi.interceptors.request.use(
  (config) => {
    const token =
      getStoredToken();

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) =>
    Promise.reject(
      createCustomerNoteApiError(
        error
      )
    )
);

customerNoteApi.interceptors.response.use(
  (response) =>
    response,

  (error) => {
    if (
      error?.response?.status ===
      401
    ) {
      clearStoredAuthentication();

      dispatchAuthenticationExpiredEvent();
    }

    return Promise.reject(
      createCustomerNoteApiError(
        error
      )
    );
  }
);

function removeEmptyValues(
  object = {}
) {
  return Object.fromEntries(
    Object.entries(
      object
    ).filter(([, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return false;
      }

      if (
        Array.isArray(value) &&
        value.length === 0
      ) {
        return false;
      }

      return true;
    })
  );
}

function encodeIdentifier(
  identifier,
  fieldName
) {
  const value =
    normaliseText(
      identifier
    );

  if (!value) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return encodeURIComponent(
    value
  );
}

function normaliseTags(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((tag) =>
            normaliseText(
              tag
            ).toLowerCase()
          )
          .filter(Boolean)
      )
    );
  }

  return Array.from(
    new Set(
      normaliseText(value)
        .split(",")
        .map((tag) =>
          tag
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
  );
}

/*
|--------------------------------------------------------------------------
| Customer note collection
|--------------------------------------------------------------------------
*/

async function listCustomerNotes(
  customerId,
  filters = {}
) {
  const safeCustomerId =
    encodeIdentifier(
      customerId,
      "Customer ID"
    );

  const response =
    await customerNoteApi.get(
      `/customer-notes/customers/${safeCustomerId}`,
      {
        params:
          removeEmptyValues(
            filters
          ),
      }
    );

  return response.data;
}

async function createCustomerNote(
  customerId,
  payload
) {
  const safeCustomerId =
    encodeIdentifier(
      customerId,
      "Customer ID"
    );

  const response =
    await customerNoteApi.post(
      `/customer-notes/customers/${safeCustomerId}`,
      payload
    );

  return response.data;
}

async function getCustomerNoteStatistics(
  customerId
) {
  const safeCustomerId =
    encodeIdentifier(
      customerId,
      "Customer ID"
    );

  const response =
    await customerNoteApi.get(
      `/customer-notes/customers/${safeCustomerId}/statistics`
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Individual customer notes
|--------------------------------------------------------------------------
*/

async function getCustomerNote(
  noteId,
  options = {}
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response =
    await customerNoteApi.get(
      `/customer-notes/${safeNoteId}`,
      {
        params:
          removeEmptyValues(
            options
          ),
      }
    );

  return response.data;
}

async function updateCustomerNote(
  noteId,
  payload
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response =
    await customerNoteApi.patch(
      `/customer-notes/${safeNoteId}`,
      payload
    );

  return response.data;
}

async function deleteCustomerNote(
  noteId
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response =
    await customerNoteApi.delete(
      `/customer-notes/${safeNoteId}`
    );

  return response.data;
}

async function restoreCustomerNote(
  noteId
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response =
    await customerNoteApi.patch(
      `/customer-notes/${safeNoteId}/restore`
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Pinning
|--------------------------------------------------------------------------
*/

async function setCustomerNotePinned(
  noteId,
  pinned
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response =
    await customerNoteApi.patch(
      `/customer-notes/${safeNoteId}/pinned`,
      {
        pinned:
          Boolean(pinned),
      }
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Follow-up management
|--------------------------------------------------------------------------
*/

async function completeCustomerNoteFollowUp(
  noteId
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response =
    await customerNoteApi.patch(
      `/customer-notes/${safeNoteId}/follow-up/complete`
    );

  return response.data;
}

async function reopenCustomerNoteFollowUp(
  noteId,
  followUpAt
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response =
    await customerNoteApi.patch(
      `/customer-notes/${safeNoteId}/follow-up/reopen`,
      {
        followUpAt:
          followUpAt || null,
      }
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Customer tags
|--------------------------------------------------------------------------
*/

async function getCustomerTagSummary(
  filters = {}
) {
  const response =
    await customerNoteApi.get(
      "/customer-notes/tags/summary",
      {
        params:
          removeEmptyValues(
            filters
          ),
      }
    );

  return response.data;
}

async function replaceCustomerTags(
  customerId,
  tags
) {
  const safeCustomerId =
    encodeIdentifier(
      customerId,
      "Customer ID"
    );

  const response =
    await customerNoteApi.put(
      `/customer-notes/customers/${safeCustomerId}/tags`,
      {
        tags:
          normaliseTags(tags),
      }
    );

  return response.data;
}

async function addCustomerTags(
  customerId,
  tags
) {
  const safeCustomerId =
    encodeIdentifier(
      customerId,
      "Customer ID"
    );

  const response =
    await customerNoteApi.patch(
      `/customer-notes/customers/${safeCustomerId}/tags/add`,
      {
        tags:
          normaliseTags(tags),
      }
    );

  return response.data;
}

async function removeCustomerTags(
  customerId,
  tags
) {
  const safeCustomerId =
    encodeIdentifier(
      customerId,
      "Customer ID"
    );

  const response =
    await customerNoteApi.patch(
      `/customer-notes/customers/${safeCustomerId}/tags/remove`,
      {
        tags:
          normaliseTags(tags),
      }
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Display helpers
|--------------------------------------------------------------------------
*/

function formatCustomerNoteType(
  value
) {
  return normaliseText(
    value || "general"
  )
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function formatCustomerNoteVisibility(
  value
) {
  return normaliseText(
    value || "staff"
  )
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getCustomerNoteAuthorName(
  note
) {
  return (
    normaliseText(
      note?.createdBy?.name
    ) ||
    normaliseText(
      note?.createdBy?.email
    ) ||
    "Unknown staff member"
  );
}

function isCustomerNoteFollowUpOverdue(
  note
) {
  if (
    !note?.requiresFollowUp ||
    note?.followUpCompleted ||
    !note?.followUpAt
  ) {
    return false;
  }

  const followUpDate =
    new Date(
      note.followUpAt
    );

  if (
    Number.isNaN(
      followUpDate.getTime()
    )
  ) {
    return false;
  }

  return (
    followUpDate.getTime() <
    Date.now()
  );
}

function getCustomerNoteStatus(
  note
) {
  if (note?.deletedAt) {
    return "deleted";
  }

  if (
    note?.requiresFollowUp &&
    note?.followUpCompleted
  ) {
    return "completed";
  }

  if (
    isCustomerNoteFollowUpOverdue(
      note
    )
  ) {
    return "overdue";
  }

  if (
    note?.requiresFollowUp
  ) {
    return "follow_up";
  }

  return "active";
}

export {
  API_BASE_URL,
  addCustomerTags,
  clearStoredAuthentication,
  completeCustomerNoteFollowUp,
  createCustomerNote,
  createCustomerNoteApiError,
  customerNoteApi,
  deleteCustomerNote,
  formatCustomerNoteType,
  formatCustomerNoteVisibility,
  getCustomerNote,
  getCustomerNoteAuthorName,
  getCustomerNoteStatistics,
  getCustomerNoteStatus,
  getCustomerTagSummary,
  isCustomerNoteFollowUpOverdue,
  listCustomerNotes,
  normaliseTags,
  removeCustomerTags,
  reopenCustomerNoteFollowUp,
  replaceCustomerTags,
  restoreCustomerNote,
  setCustomerNotePinned,
  updateCustomerNote,
};

export default {
  addCustomerTags,
  completeCustomerNoteFollowUp,
  createCustomerNote,
  deleteCustomerNote,
  formatCustomerNoteType,
  formatCustomerNoteVisibility,
  getCustomerNote,
  getCustomerNoteAuthorName,
  getCustomerNoteStatistics,
  getCustomerNoteStatus,
  getCustomerTagSummary,
  isCustomerNoteFollowUpOverdue,
  listCustomerNotes,
  removeCustomerTags,
  reopenCustomerNoteFollowUp,
  replaceCustomerTags,
  restoreCustomerNote,
  setCustomerNotePinned,
  updateCustomerNote,
};