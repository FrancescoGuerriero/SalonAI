import API from "../api/axios.js";

const BASE_URL = "/customer-notes";

function removeEmptyValues(
  object = {}
) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

function responseData(response) {
  return response?.data || {};
}

function encodeIdentifier(
  value,
  fieldName
) {
  const identifier = String(
    value ?? ""
  ).trim();

  if (!identifier) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return encodeURIComponent(
    identifier
  );
}

export async function listCustomerFollowUps(
  params = {}
) {
  const response = await API.get(
    `${BASE_URL}/follow-ups`,
    {
      params:
        removeEmptyValues(params),
    }
  );

  return responseData(response);
}

export async function getCustomerFollowUpSummary() {
  const response = await API.get(
    `${BASE_URL}/follow-ups/summary`
  );

  return responseData(response);
}

export async function scheduleCustomerFollowUp(
  noteId,
  followUpAt
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response = await API.patch(
    `${BASE_URL}/follow-ups/${safeNoteId}/schedule`,
    {
      followUpAt,
    }
  );

  return responseData(response);
}

export async function completeCustomerFollowUp(
  noteId
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response = await API.patch(
    `${BASE_URL}/${safeNoteId}/follow-up/complete`
  );

  return responseData(response);
}

export async function reopenCustomerFollowUp(
  noteId,
  followUpAt = null
) {
  const safeNoteId =
    encodeIdentifier(
      noteId,
      "Customer note ID"
    );

  const response = await API.patch(
    `${BASE_URL}/${safeNoteId}/follow-up/reopen`,
    {
      followUpAt,
    }
  );

  return responseData(response);
}

const customerFollowUpApi = {
  complete:
    completeCustomerFollowUp,
  getSummary:
    getCustomerFollowUpSummary,
  list:
    listCustomerFollowUps,
  reopen:
    reopenCustomerFollowUp,
  schedule:
    scheduleCustomerFollowUp,
};

export default customerFollowUpApi;
