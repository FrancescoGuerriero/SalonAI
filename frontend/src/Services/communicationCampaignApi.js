import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const CAMPAIGN_ENDPOINT =
  "/communication-campaigns";

const communicationCampaignClient =
  axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    withCredentials: true,
  });

function getAuthenticationToken() {
  try {
    return (
      window.localStorage.getItem(
        "salonai_token"
      ) ||
      window.localStorage.getItem(
        "token"
      )
    );
  } catch {
    return null;
  }
}

function clearAuthenticationStorage() {
  try {
    window.localStorage.removeItem(
      "salonai_token"
    );

    window.localStorage.removeItem(
      "salonai_user"
    );

    window.localStorage.removeItem(
      "token"
    );
  } catch {
    // Continue when local storage is unavailable.
  }
}

function cleanQueryParameters(
  parameters = {}
) {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

function requireIdentifier(
  value,
  fieldName
) {
  const identifier =
    String(
      value || ""
    ).trim();

  if (!identifier) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return identifier;
}

function getCampaignIdentifier(
  campaign
) {
  return requireIdentifier(
    campaign?._id ||
      campaign?.id ||
      campaign,
    "campaignId"
  );
}

function getRecipientIdentifier(
  recipient
) {
  return requireIdentifier(
    recipient?._id ||
      recipient?.id ||
      recipient,
    "recipientId"
  );
}

function unwrapResponse(
  response
) {
  return (
    response?.data ??
    response
  );
}

/*
|--------------------------------------------------------------------------
| Axios interceptors
|--------------------------------------------------------------------------
*/

communicationCampaignClient.interceptors.request.use(
  (config) => {
    const token =
      getAuthenticationToken();

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) =>
    Promise.reject(error)
);

communicationCampaignClient.interceptors.response.use(
  (response) =>
    response,

  (error) => {
    if (
      error?.response?.status ===
      401
    ) {
      clearAuthenticationStorage();
    }

    return Promise.reject(
      error
    );
  }
);

/*
|--------------------------------------------------------------------------
| Campaign CRUD
|--------------------------------------------------------------------------
*/

/**
 * Create a communication campaign.
 *
 * POST /api/communication-campaigns
 */
export async function createCommunicationCampaign(
  payload
) {
  const response =
    await communicationCampaignClient.post(
      CAMPAIGN_ENDPOINT,
      payload
    );

  return unwrapResponse(
    response
  );
}

/**
 * List communication campaigns.
 *
 * GET /api/communication-campaigns
 */
export async function getCommunicationCampaigns(
  parameters = {}
) {
  const response =
    await communicationCampaignClient.get(
      CAMPAIGN_ENDPOINT,
      {
        params:
          cleanQueryParameters(
            parameters
          ),
      }
    );

  return unwrapResponse(
    response
  );
}

/**
 * Retrieve a single communication campaign.
 *
 * GET /api/communication-campaigns/:campaignId
 */
export async function getCommunicationCampaign(
  campaign
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.get(
      `${CAMPAIGN_ENDPOINT}/${campaignId}`
    );

  return unwrapResponse(
    response
  );
}

/**
 * Update an editable communication campaign.
 *
 * PATCH /api/communication-campaigns/:campaignId
 */
export async function updateCommunicationCampaign(
  campaign,
  payload
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.patch(
      `${CAMPAIGN_ENDPOINT}/${campaignId}`,
      payload
    );

  return unwrapResponse(
    response
  );
}

/**
 * Duplicate a communication campaign.
 *
 * POST /api/communication-campaigns/:campaignId/duplicate
 */
export async function duplicateCommunicationCampaign(
  campaign,
  payload = {}
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/duplicate`,
      payload
    );

  return unwrapResponse(
    response
  );
}

/**
 * Delete a draft, failed or cancelled campaign.
 *
 * DELETE /api/communication-campaigns/:campaignId
 */
export async function deleteCommunicationCampaign(
  campaign
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.delete(
      `${CAMPAIGN_ENDPOINT}/${campaignId}`
    );

  return unwrapResponse(
    response
  );
}

/*
|--------------------------------------------------------------------------
| Audience previews
|--------------------------------------------------------------------------
*/

/**
 * Preview a campaign audience before the campaign is saved.
 *
 * POST /api/communication-campaigns/preview
 */
export async function previewNewCampaignAudience(
  campaignPayload,
  {
    previewLimit = 10,
  } = {}
) {
  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/preview`,
      {
        campaign:
          campaignPayload ||
          {},

        previewLimit,
      }
    );

  return unwrapResponse(
    response
  );
}

/**
 * Preview the audience of an existing campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/audience/preview
 */
export async function previewExistingCampaignAudience(
  campaign,
  {
    previewLimit = 10,
  } = {}
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/audience/preview`,
      {
        previewLimit,
      }
    );

  return unwrapResponse(
    response
  );
}

/*
|--------------------------------------------------------------------------
| Campaign recipients
|--------------------------------------------------------------------------
*/

/**
 * Generate personalised recipient records.
 *
 * POST
 * /api/communication-campaigns/:campaignId/recipients/prepare
 */
export async function prepareCommunicationCampaignRecipients(
  campaign,
  {
    replaceExisting = true,
  } = {}
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/recipients/prepare`,
      {
        replaceExisting,
      }
    );

  return unwrapResponse(
    response
  );
}

/**
 * List campaign recipient records.
 *
 * GET
 * /api/communication-campaigns/:campaignId/recipients
 */
export async function getCommunicationCampaignRecipients(
  campaign,
  parameters = {}
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.get(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/recipients`,
      {
        params:
          cleanQueryParameters(
            parameters
          ),
      }
    );

  return unwrapResponse(
    response
  );
}

/**
 * Retrieve a single campaign recipient.
 *
 * GET
 * /api/communication-campaigns/:campaignId/recipients/:recipientId
 */
export async function getCommunicationCampaignRecipient(
  campaign,
  recipient
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const recipientId =
    getRecipientIdentifier(
      recipient
    );

  const response =
    await communicationCampaignClient.get(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/recipients/${recipientId}`
    );

  return unwrapResponse(
    response
  );
}

/*
|--------------------------------------------------------------------------
| Campaign delivery lifecycle
|--------------------------------------------------------------------------
*/

/**
 * Queue a campaign for immediate delivery.
 *
 * POST
 * /api/communication-campaigns/:campaignId/launch
 */
export async function launchCommunicationCampaign(
  campaign
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/launch`
    );

  return unwrapResponse(
    response
  );
}

/**
 * Schedule a campaign for future delivery.
 *
 * POST
 * /api/communication-campaigns/:campaignId/schedule
 */
export async function scheduleCommunicationCampaign(
  campaign,
  schedule
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/schedule`,
      {
        schedule:
          schedule ||
          {},
      }
    );

  return unwrapResponse(
    response
  );
}

/**
 * Pause a queued or processing campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/pause
 */
export async function pauseCommunicationCampaign(
  campaign
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/pause`
    );

  return unwrapResponse(
    response
  );
}

/**
 * Resume a paused campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/resume
 */
export async function resumeCommunicationCampaign(
  campaign
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/resume`
    );

  return unwrapResponse(
    response
  );
}

/**
 * Cancel a communication campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/cancel
 */
export async function cancelCommunicationCampaign(
  campaign,
  reason = ""
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/cancel`,
      {
        reason:
          String(
            reason || ""
          ).trim(),
      }
    );

  return unwrapResponse(
    response
  );
}

/**
 * Recalculate campaign delivery counts.
 *
 * POST
 * /api/communication-campaigns/:campaignId/delivery-counts/refresh
 */
export async function refreshCommunicationCampaignDeliveryCounts(
  campaign
) {
  const campaignId =
    getCampaignIdentifier(
      campaign
    );

  const response =
    await communicationCampaignClient.post(
      `${CAMPAIGN_ENDPOINT}/${campaignId}/delivery-counts/refresh`
    );

  return unwrapResponse(
    response
  );
}

/*
|--------------------------------------------------------------------------
| Campaign reporting
|--------------------------------------------------------------------------
*/

/**
 * Retrieve campaign analytics and summary information.
 *
 * GET /api/communication-campaigns/summary
 */
export async function getCommunicationCampaignSummary(
  parameters = {}
) {
  const response =
    await communicationCampaignClient.get(
      `${CAMPAIGN_ENDPOINT}/summary`,
      {
        params:
          cleanQueryParameters(
            parameters
          ),
      }
    );

  return unwrapResponse(
    response
  );
}

/*
|--------------------------------------------------------------------------
| Error handling
|--------------------------------------------------------------------------
*/

/**
 * Extract a useful user-facing message from an API error.
 */
export function getCommunicationCampaignErrorMessage(
  error,
  fallbackMessage =
    "The communication campaign request failed."
) {
  if (!error) {
    return fallbackMessage;
  }

  if (
    typeof error ===
      "string" &&
    error.trim()
  ) {
    return error.trim();
  }

  const responseData =
    error?.response?.data;

  if (
    typeof responseData ===
      "string" &&
    responseData.trim()
  ) {
    return responseData.trim();
  }

  if (
    typeof responseData?.message ===
      "string" &&
    responseData.message.trim()
  ) {
    return responseData.message.trim();
  }

  if (
    typeof responseData?.error ===
      "string" &&
    responseData.error.trim()
  ) {
    return responseData.error.trim();
  }

  if (
    Array.isArray(
      responseData?.errors
    ) &&
    responseData.errors.length >
      0
  ) {
    const messages =
      responseData.errors
        .map((item) => {
          if (
            typeof item ===
            "string"
          ) {
            return item;
          }

          return (
            item?.message ||
            item?.msg ||
            ""
          );
        })
        .filter(Boolean);

    if (
      messages.length >
      0
    ) {
      return messages.join(
        " "
      );
    }
  }

  if (
    error?.response?.status ===
    401
  ) {
    return "Your session has expired or is invalid. Please sign in again.";
  }

  if (
    error?.response?.status ===
    403
  ) {
    return "You do not have permission to manage communication campaigns.";
  }

  if (
    typeof error?.message ===
      "string" &&
    error.message.trim()
  ) {
    if (
      error.code ===
      "ECONNABORTED"
    ) {
      return "The campaign request timed out. Check that the backend server is running and try again.";
    }

    if (
      error.message ===
      "Network Error"
    ) {
      return "Unable to connect to the SalonAI backend. Check that the backend server is running.";
    }

    return error.message.trim();
  }

  return fallbackMessage;
}

export {
  API_BASE_URL,
  CAMPAIGN_ENDPOINT,
  communicationCampaignClient,
};

const communicationCampaignApi = {
  createCommunicationCampaign,
  getCommunicationCampaigns,
  getCommunicationCampaign,
  updateCommunicationCampaign,
  duplicateCommunicationCampaign,
  deleteCommunicationCampaign,
  previewNewCampaignAudience,
  previewExistingCampaignAudience,
  prepareCommunicationCampaignRecipients,
  getCommunicationCampaignRecipients,
  getCommunicationCampaignRecipient,
  launchCommunicationCampaign,
  scheduleCommunicationCampaign,
  pauseCommunicationCampaign,
  resumeCommunicationCampaign,
  cancelCommunicationCampaign,
  refreshCommunicationCampaignDeliveryCounts,
  getCommunicationCampaignSummary,
  getCommunicationCampaignErrorMessage,
};

export default communicationCampaignApi;