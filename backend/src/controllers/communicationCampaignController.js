import {
  cancelCommunicationCampaign,
  createCommunicationCampaign,
  deleteCommunicationCampaign,
  duplicateCommunicationCampaign,
  getCampaignRecipient,
  getCommunicationCampaign,
  getCommunicationCampaignSummary,
  launchCommunicationCampaign,
  listCampaignRecipients,
  listCommunicationCampaigns,
  pauseCommunicationCampaign,
  prepareCampaignRecipients,
  previewCampaignAudience,
  refreshCampaignDeliveryCounts,
  resumeCommunicationCampaign,
  scheduleCommunicationCampaign,
  updateCommunicationCampaign,
} from "../services/communicationCampaignService.js";

function getRequestUser(request) {
  return (
    request.user ||
    request.auth?.user ||
    null
  );
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value
      .trim()
      .toLowerCase();

    if (
      normalizedValue === "true" ||
      normalizedValue === "1"
    ) {
      return true;
    }

    if (
      normalizedValue === "false" ||
      normalizedValue === "0"
    ) {
      return false;
    }
  }

  return fallback;
}

function getCampaignFilters(query = {}) {
  return {
    search: query.search,
    status: query.status,
    campaignType: query.campaignType,
    channel: query.channel,
    sendMode: query.sendMode,
    createdBy: query.createdBy,
    startDate: query.startDate,
    endDate: query.endDate,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
  };
}

function getRecipientFilters(query = {}) {
  return {
    search: query.search,
    status: query.status,
    page: query.page,
    limit: query.limit,
  };
}

function sendControllerError(
  error,
  request,
  response,
  next
) {
  if (typeof next === "function") {
    next(error);
    return;
  }

  const statusCode =
    Number(error?.statusCode) || 500;

  response.status(statusCode).json({
    success: false,
    message:
      error?.message ||
      "An unexpected server error occurred.",
    code:
      error?.code ||
      "INTERNAL_SERVER_ERROR",
  });
}

export async function createCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await createCommunicationCampaign(
        request.body || {},
        getRequestUser(request)
      );

    response.status(201).json({
      success: true,
      message:
        "Communication campaign created successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function listCampaigns(
  request,
  response,
  next
) {
  try {
    const result =
      await listCommunicationCampaigns(
        getCampaignFilters(request.query)
      );

    response.status(200).json({
      success: true,
      campaigns: result.campaigns,
      pagination: result.pagination,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function getCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await getCommunicationCampaign(
        request.params.campaignId
      );

    response.status(200).json({
      success: true,
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function updateCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await updateCommunicationCampaign(
        request.params.campaignId,
        request.body || {},
        getRequestUser(request)
      );

    response.status(200).json({
      success: true,
      message:
        "Communication campaign updated successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function duplicateCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await duplicateCommunicationCampaign(
        request.params.campaignId,
        request.body || {},
        getRequestUser(request)
      );

    response.status(201).json({
      success: true,
      message:
        "Communication campaign duplicated successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function removeCampaign(
  request,
  response,
  next
) {
  try {
    const result =
      await deleteCommunicationCampaign(
        request.params.campaignId
      );

    response.status(200).json({
      success: true,
      message: result.message,
      campaignId: result.campaignId,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function previewNewCampaignAudience(
  request,
  response,
  next
) {
  try {
    const payload =
      request.body?.campaign ||
      request.body?.payload ||
      request.body ||
      {};

    const options = {
      limit:
        request.body?.previewLimit ||
        request.body?.limit ||
        request.query?.limit,
    };

    const preview =
      await previewCampaignAudience(
        payload,
        options
      );

    response.status(200).json({
      success: true,
      message:
        "Campaign audience preview generated successfully.",
      preview,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function previewExistingCampaignAudience(
  request,
  response,
  next
) {
  try {
    const preview =
      await previewCampaignAudience(
        request.params.campaignId,
        {
          limit:
            request.body?.previewLimit ||
            request.body?.limit ||
            request.query?.limit,
        }
      );

    response.status(200).json({
      success: true,
      message:
        "Campaign audience preview generated successfully.",
      preview,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function prepareRecipients(
  request,
  response,
  next
) {
  try {
    const replaceExisting =
      normalizeBoolean(
        request.body?.replaceExisting,
        true
      );

    const result =
      await prepareCampaignRecipients(
        request.params.campaignId,
        {
          replaceExisting,
        }
      );

    response.status(200).json({
      success: true,
      message:
        "Campaign recipients prepared successfully.",
      campaign: result.campaign,
      recipients: result.recipients,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function launchCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await launchCommunicationCampaign(
        request.params.campaignId,
        getRequestUser(request)
      );

    response.status(200).json({
      success: true,
      message:
        "Communication campaign queued successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function scheduleCampaign(
  request,
  response,
  next
) {
  try {
    const schedule =
      request.body?.schedule ||
      request.body ||
      {};

    const campaign =
      await scheduleCommunicationCampaign(
        request.params.campaignId,
        schedule,
        getRequestUser(request)
      );

    response.status(200).json({
      success: true,
      message:
        "Communication campaign scheduled successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function pauseCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await pauseCommunicationCampaign(
        request.params.campaignId,
        getRequestUser(request)
      );

    response.status(200).json({
      success: true,
      message:
        "Communication campaign paused successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function resumeCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await resumeCommunicationCampaign(
        request.params.campaignId,
        getRequestUser(request)
      );

    response.status(200).json({
      success: true,
      message:
        "Communication campaign resumed successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function cancelCampaign(
  request,
  response,
  next
) {
  try {
    const reason =
      request.body?.reason ||
      request.body?.cancellationReason ||
      "";

    const campaign =
      await cancelCommunicationCampaign(
        request.params.campaignId,
        reason,
        getRequestUser(request)
      );

    response.status(200).json({
      success: true,
      message:
        "Communication campaign cancelled successfully.",
      campaign,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function listRecipients(
  request,
  response,
  next
) {
  try {
    const result =
      await listCampaignRecipients(
        request.params.campaignId,
        getRecipientFilters(request.query)
      );

    response.status(200).json({
      success: true,
      recipients: result.recipients,
      pagination: result.pagination,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function getRecipient(
  request,
  response,
  next
) {
  try {
    const recipient =
      await getCampaignRecipient(
        request.params.campaignId,
        request.params.recipientId
      );

    response.status(200).json({
      success: true,
      recipient,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function refreshDeliveryCounts(
  request,
  response,
  next
) {
  try {
    const result =
      await refreshCampaignDeliveryCounts(
        request.params.campaignId
      );

    response.status(200).json({
      success: true,
      message:
        "Campaign delivery counts refreshed successfully.",
      campaignId: result.campaignId,
      status: result.status,
      deliveryCounts:
        result.deliveryCounts,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

export async function getCampaignSummary(
  request,
  response,
  next
) {
  try {
    const result =
      await getCommunicationCampaignSummary(
        getCampaignFilters(request.query)
      );

    response.status(200).json({
      success: true,
      summary: result.summary,
      byStatus: result.byStatus,
      byChannel: result.byChannel,
      byCampaignType:
        result.byCampaignType,
      upcomingScheduled:
        result.upcomingScheduled,
    });
  } catch (error) {
    sendControllerError(
      error,
      request,
      response,
      next
    );
  }
}

const communicationCampaignController = {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  duplicateCampaign,
  removeCampaign,
  previewNewCampaignAudience,
  previewExistingCampaignAudience,
  prepareRecipients,
  launchCampaign,
  scheduleCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  listRecipients,
  getRecipient,
  refreshDeliveryCounts,
  getCampaignSummary,
};

export default communicationCampaignController;