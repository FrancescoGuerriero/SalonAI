import API from "../api/axios.js";

const BASE_URL =
  "/scheduled-communications";

function removeEmptyValues(values = {}) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

function normaliseCampaignId(campaignId) {
  const value = String(
    campaignId || ""
  ).trim();

  if (!value) {
    throw new Error(
      "A communication campaign ID is required."
    );
  }

  return value;
}

function buildSchedulePayload({
  scheduledAt,
  timezone = "Europe/London",
  batchSize = 100,
  delayBetweenBatchesSeconds = 0,
} = {}) {
  return removeEmptyValues({
    scheduledAt,
    timezone,
    batchSize,
    delayBetweenBatchesSeconds,
  });
}

async function getScheduledCommunications(
  filters = {}
) {
  const response = await API.get(
    BASE_URL,
    {
      params: removeEmptyValues({
        status:
          filters.status ||
          "all",

        channel:
          filters.channel ||
          "all",

        search:
          filters.search ||
          "",

        scheduledFrom:
          filters.scheduledFrom,

        scheduledTo:
          filters.scheduledTo,

        page:
          filters.page || 1,

        limit:
          filters.limit || 20,

        sortDirection:
          filters.sortDirection ||
          "asc",
      }),
    }
  );

  return response.data;
}

async function getOverview() {
  const response = await API.get(
    `${BASE_URL}/overview`
  );

  return response.data;
}

async function getDueCommunications({
  scheduledBefore,
  limit = 100,
} = {}) {
  const response = await API.get(
    `${BASE_URL}/due`,
    {
      params: removeEmptyValues({
        scheduledBefore,
        limit,
      }),
    }
  );

  return response.data;
}

async function getById(campaignId) {
  const id =
    normaliseCampaignId(
      campaignId
    );

  const response = await API.get(
    `${BASE_URL}/${id}`
  );

  return response.data;
}

async function schedule(
  campaignId,
  scheduleDetails
) {
  const id =
    normaliseCampaignId(
      campaignId
    );

  const response = await API.patch(
    `${BASE_URL}/${id}/schedule`,
    buildSchedulePayload(
      scheduleDetails
    )
  );

  return response.data;
}

async function reschedule(
  campaignId,
  scheduleDetails
) {
  const id =
    normaliseCampaignId(
      campaignId
    );

  const response = await API.patch(
    `${BASE_URL}/${id}/reschedule`,
    buildSchedulePayload(
      scheduleDetails
    )
  );

  return response.data;
}

async function unschedule(campaignId) {
  const id =
    normaliseCampaignId(
      campaignId
    );

  const response = await API.patch(
    `${BASE_URL}/${id}/unschedule`
  );

  return response.data;
}

async function cancel(
  campaignId,
  reason = ""
) {
  const id =
    normaliseCampaignId(
      campaignId
    );

  const response = await API.patch(
    `${BASE_URL}/${id}/cancel`,
    {
      reason:
        String(
          reason || ""
        ).trim(),
    }
  );

  return response.data;
}

const scheduledCommunicationService = {
  getScheduledCommunications,
  getOverview,
  getDueCommunications,
  getById,
  schedule,
  reschedule,
  unschedule,
  cancel,
};

export {
  buildSchedulePayload,
  removeEmptyValues,
};

export default scheduledCommunicationService;