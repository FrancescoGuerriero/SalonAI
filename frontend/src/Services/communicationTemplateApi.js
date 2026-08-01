import axios from "axios";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
).replace(/\/+$/, "");

const communicationTemplateClient =
  axios.create({
    baseURL: `${API_BASE_URL}/communication-templates`,
    withCredentials: true,

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    timeout: 30000,
  });

communicationTemplateClient.interceptors.request.use(
  (config) => {
    const token =
      window.localStorage.getItem("token") ||
      window.localStorage.getItem("salonai_token");

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

function removeEmptyParameters(parameters = {}) {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

function normalizeTemplatePayload(payload = {}) {
  return {
    name: String(payload.name || "").trim(),

    description: String(
      payload.description || ""
    ).trim(),

    campaignType:
      payload.campaignType || "general",

    channel: payload.channel || "email",

    subject: String(
      payload.subject || ""
    ).trim(),

    body: String(payload.body || "").trim(),

    variables: Array.isArray(
      payload.variables
    )
      ? payload.variables
      : [],

    tags: Array.isArray(payload.tags)
      ? payload.tags
      : typeof payload.tags === "string"
        ? payload.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],

    active:
      payload.active === undefined
        ? true
        : Boolean(payload.active),

    metadata:
      payload.metadata &&
      typeof payload.metadata === "object" &&
      !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
  };
}

function getApiPayload(response) {
  return response?.data ?? {};
}

export async function createCommunicationTemplate(
  payload
) {
  const response =
    await communicationTemplateClient.post(
      "/",
      normalizeTemplatePayload(payload)
    );

  return getApiPayload(response);
}

export async function getCommunicationTemplates(
  filters = {}
) {
  const response =
    await communicationTemplateClient.get(
      "/",
      {
        params: removeEmptyParameters({
          page: filters.page,
          limit: filters.limit,
          search: filters.search,
          campaignType:
            filters.campaignType,
          channel: filters.channel,
          active: filters.active,
          isSystemTemplate:
            filters.isSystemTemplate,
          createdBy: filters.createdBy,
          tag: filters.tag,
          sort: filters.sort,
        }),
      }
    );

  return getApiPayload(response);
}

export async function getCommunicationTemplate(
  templateId
) {
  if (!templateId) {
    throw new Error(
      "A communication template ID is required."
    );
  }

  const response =
    await communicationTemplateClient.get(
      `/${templateId}`
    );

  return getApiPayload(response);
}

export async function getCommunicationTemplateBySlug(
  slug
) {
  if (!slug) {
    throw new Error(
      "A communication template slug is required."
    );
  }

  const response =
    await communicationTemplateClient.get(
      `/slug/${encodeURIComponent(slug)}`
    );

  return getApiPayload(response);
}

export async function updateCommunicationTemplate(
  templateId,
  payload
) {
  if (!templateId) {
    throw new Error(
      "A communication template ID is required."
    );
  }

  const preparedPayload = {};

  const editableFields = [
    "name",
    "description",
    "campaignType",
    "channel",
    "subject",
    "body",
    "variables",
    "tags",
    "active",
    "metadata",
  ];

  for (const field of editableFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        payload || {},
        field
      )
    ) {
      preparedPayload[field] =
        payload[field];
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      preparedPayload,
      "tags"
    ) &&
    typeof preparedPayload.tags === "string"
  ) {
    preparedPayload.tags =
      preparedPayload.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
  }

  const response =
    await communicationTemplateClient.patch(
      `/${templateId}`,
      preparedPayload
    );

  return getApiPayload(response);
}

export async function setCommunicationTemplateStatus(
  templateId,
  active
) {
  if (!templateId) {
    throw new Error(
      "A communication template ID is required."
    );
  }

  const response =
    await communicationTemplateClient.patch(
      `/${templateId}/status`,
      {
        active: Boolean(active),
      }
    );

  return getApiPayload(response);
}

export async function renderCommunicationTemplate(
  templateId,
  variables = {},
  options = {}
) {
  if (!templateId) {
    throw new Error(
      "A communication template ID is required."
    );
  }

  const response =
    await communicationTemplateClient.post(
      `/${templateId}/render`,
      {
        variables:
          variables &&
          typeof variables === "object" &&
          !Array.isArray(variables)
            ? variables
            : {},

        options: {
          requireActive:
            options.requireActive !== false,

          requireAllVariables:
            options.requireAllVariables ===
            true,

          recordUsage:
            options.recordUsage === true,
        },
      }
    );

  return getApiPayload(response);
}

export async function duplicateCommunicationTemplate(
  templateId,
  payload = {}
) {
  if (!templateId) {
    throw new Error(
      "A communication template ID is required."
    );
  }

  const response =
    await communicationTemplateClient.post(
      `/${templateId}/duplicate`,
      payload
    );

  return getApiPayload(response);
}

export async function deleteCommunicationTemplate(
  templateId
) {
  if (!templateId) {
    throw new Error(
      "A communication template ID is required."
    );
  }

  const response =
    await communicationTemplateClient.delete(
      `/${templateId}`
    );

  return getApiPayload(response);
}

export async function getCommunicationTemplateSummary(
  filters = {}
) {
  const response =
    await communicationTemplateClient.get(
      "/summary",
      {
        params: removeEmptyParameters({
          search: filters.search,
          campaignType:
            filters.campaignType,
          channel: filters.channel,
          active: filters.active,
          isSystemTemplate:
            filters.isSystemTemplate,
          createdBy: filters.createdBy,
          tag: filters.tag,
        }),
      }
    );

  return getApiPayload(response);
}

export function getCommunicationTemplateErrorMessage(
  error,
  fallbackMessage = "The communication template request failed."
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

const communicationTemplateApi = {
  createCommunicationTemplate,
  getCommunicationTemplates,
  getCommunicationTemplate,
  getCommunicationTemplateBySlug,
  updateCommunicationTemplate,
  setCommunicationTemplateStatus,
  renderCommunicationTemplate,
  duplicateCommunicationTemplate,
  deleteCommunicationTemplate,
  getCommunicationTemplateSummary,
};

export default communicationTemplateApi;