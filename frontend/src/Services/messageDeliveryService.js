import axios from "axios";

const TOKEN_STORAGE_KEY = "salonai_token";
const USER_STORAGE_KEY = "salonai_user";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
).replace(/\/+$/, "");

const messageDeliveryApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

function normaliseText(value) {
  return String(value ?? "").trim();
}

function createApiError(error) {
  const responseData = error?.response?.data || {};
  const apiError = new Error(
    responseData.message ||
      error?.message ||
      "The SalonAI API request failed."
  );

  apiError.name = "SalonAIApiError";
  apiError.status =
    error?.response?.status || null;
  apiError.statusCode =
    error?.response?.status ||
    responseData.statusCode ||
    null;
  apiError.code =
    responseData.code ||
    error?.code ||
    "SALONAI_API_ERROR";
  apiError.retryable = Boolean(
    responseData.retryable
  );
  apiError.channel =
    responseData.channel || null;
  apiError.details =
    responseData.details || null;
  apiError.data = responseData;

  return apiError;
}

function removeStoredAuthentication() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

messageDeliveryApi.interceptors.request.use(
  (config) => {
    const token = normaliseText(
      localStorage.getItem(TOKEN_STORAGE_KEY)
    );

    if (token) {
      config.headers =
        config.headers || {};
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) =>
    Promise.reject(createApiError(error))
);

messageDeliveryApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      removeStoredAuthentication();

      window.dispatchEvent(
        new CustomEvent(
          "salonai:authentication-expired"
        )
      );
    }

    return Promise.reject(
      createApiError(error)
    );
  }
);

function compact(object = {}) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

async function getDeliveryConfiguration() {
  const response =
    await messageDeliveryApi.get(
      "/message-delivery/configuration"
    );
  return response.data;
}

async function verifyAllDeliveryChannels() {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery/verify"
    );
  return response.data;
}

async function verifyDeliveryChannel(channel) {
  const response =
    await messageDeliveryApi.post(
      `/message-delivery/verify/${encodeURIComponent(
        normaliseText(channel).toLowerCase()
      )}`
    );
  return response.data;
}

async function sendMessage(payload) {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery/send",
      payload
    );
  return response.data;
}

async function sendMessageBatch(messages, options = {}) {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery/send-batch",
      {
        ...options,
        messages,
      }
    );
  return response.data;
}

async function listDeliveryRecords(filters = {}) {
  const response =
    await messageDeliveryApi.get(
      "/message-delivery/deliveries",
      {
        params: compact(filters),
      }
    );
  return response.data;
}

async function getDeliveryRecord(identifier) {
  const response =
    await messageDeliveryApi.get(
      `/message-delivery/deliveries/${encodeURIComponent(
        normaliseText(identifier)
      )}`
    );
  return response.data;
}

async function retryDeliveryRecord(
  identifier,
  payload = {}
) {
  const response =
    await messageDeliveryApi.post(
      `/message-delivery/deliveries/${encodeURIComponent(
        normaliseText(identifier)
      )}/retry`,
      payload
    );
  return response.data;
}

async function retryDueDeliveryRecords(payload = {}) {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery/deliveries/retries/process-due",
      payload
    );
  return response.data;
}

async function cancelDeliveryRecord(
  identifier,
  reason = ""
) {
  const response =
    await messageDeliveryApi.patch(
      `/message-delivery/deliveries/${encodeURIComponent(
        normaliseText(identifier)
      )}/cancel`,
      {
        reason: normaliseText(reason),
      }
    );
  return response.data;
}

async function getCampaignDeliverySummary(campaignId) {
  const response =
    await messageDeliveryApi.get(
      `/message-delivery/campaigns/${encodeURIComponent(
        normaliseText(campaignId)
      )}/summary`
    );
  return response.data;
}

async function getProviderDeliveryStatus(
  channel,
  providerMessageId
) {
  const response =
    await messageDeliveryApi.get(
      `/message-delivery/provider-status/${encodeURIComponent(
        normaliseText(channel).toLowerCase()
      )}/${encodeURIComponent(
        normaliseText(providerMessageId)
      )}`
    );
  return response.data;
}

async function previewCampaignAudience(
  campaignId,
  options = {}
) {
  const response =
    await messageDeliveryApi.get(
      `/campaign-delivery/${encodeURIComponent(
        normaliseText(campaignId)
      )}/audience-preview`,
      {
        params: compact(options),
      }
    );
  return response.data;
}

async function deliverCampaign(
  campaignId,
  options = {}
) {
  const response =
    await messageDeliveryApi.post(
      `/campaign-delivery/${encodeURIComponent(
        normaliseText(campaignId)
      )}/deliver`,
      options
    );
  return response.data;
}

async function listDueCampaigns(options = {}) {
  const response =
    await messageDeliveryApi.get(
      "/campaign-delivery/due",
      {
        params: compact(options),
      }
    );
  return response.data;
}

async function processDueCampaigns(options = {}) {
  const response =
    await messageDeliveryApi.post(
      "/campaign-delivery/due/process",
      options
    );
  return response.data;
}

async function getSchedulerStatus() {
  const response =
    await messageDeliveryApi.get(
      "/message-delivery-scheduler/status"
    );
  return response.data;
}

async function runSchedulerNow(options = {}) {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery-scheduler/run",
      options
    );
  return response.data;
}

async function startScheduler(options = {}) {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery-scheduler/start",
      options
    );
  return response.data;
}

async function stopScheduler(options = {}) {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery-scheduler/stop",
      options
    );
  return response.data;
}

async function restartScheduler(options = {}) {
  const response =
    await messageDeliveryApi.post(
      "/message-delivery-scheduler/restart",
      options
    );
  return response.data;
}

export {
  API_BASE_URL,
  cancelDeliveryRecord,
  deliverCampaign,
  getCampaignDeliverySummary,
  getDeliveryConfiguration,
  getDeliveryRecord,
  getProviderDeliveryStatus,
  getSchedulerStatus,
  listDeliveryRecords,
  listDueCampaigns,
  messageDeliveryApi,
  previewCampaignAudience,
  processDueCampaigns,
  removeStoredAuthentication,
  restartScheduler,
  retryDeliveryRecord,
  retryDueDeliveryRecords,
  runSchedulerNow,
  sendMessage,
  sendMessageBatch,
  startScheduler,
  stopScheduler,
  verifyAllDeliveryChannels,
  verifyDeliveryChannel,
};

export default {
  cancelDeliveryRecord,
  deliverCampaign,
  getCampaignDeliverySummary,
  getDeliveryConfiguration,
  getDeliveryRecord,
  getProviderDeliveryStatus,
  getSchedulerStatus,
  listDeliveryRecords,
  listDueCampaigns,
  previewCampaignAudience,
  processDueCampaigns,
  restartScheduler,
  retryDeliveryRecord,
  retryDueDeliveryRecords,
  runSchedulerNow,
  sendMessage,
  sendMessageBatch,
  startScheduler,
  stopScheduler,
  verifyAllDeliveryChannels,
  verifyDeliveryChannel,
};

