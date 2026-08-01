import {
  cancelScheduledCommunication,
  getDueScheduledCommunications,
  getScheduledCommunicationById,
  getScheduledCommunicationOverview,
  getScheduledCommunications,
  rescheduleCommunicationCampaign,
  scheduleCommunicationCampaign,
  unscheduleCommunicationCampaign,
} from "../services/scheduledCommunicationService.js";

function getAuthenticatedUserId(request) {
  return (
    request.user?._id ||
    request.user?.id ||
    request.auth?.userId ||
    null
  );
}

function parseOptionalNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : undefined;
}

function parseOptionalBoolean(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    value === true ||
    String(value).toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    String(value).toLowerCase() === "false"
  ) {
    return false;
  }

  return undefined;
}

function getCampaignId(request) {
  return (
    request.params.campaignId ||
    request.params.id
  );
}

export async function listScheduledCommunications(
  request,
  response,
  next
) {
  try {
    const result =
      await getScheduledCommunications({
        status:
          request.query.status ||
          "all",

        channel:
          request.query.channel ||
          "all",

        search:
          request.query.search ||
          "",

        scheduledFrom:
          request.query.scheduledFrom,

        scheduledTo:
          request.query.scheduledTo,

        page:
          parseOptionalNumber(
            request.query.page
          ) || 1,

        limit:
          parseOptionalNumber(
            request.query.limit
          ) || 20,

        sortDirection:
          request.query.sortDirection ||
          "asc",

        includeUnscheduled:
          parseOptionalBoolean(
            request.query
              .includeUnscheduled
          ) || false,
      });

    return response.status(200).json({
      success: true,

      message:
        "Scheduled communications retrieved successfully.",

      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getScheduledCommunication(
  request,
  response,
  next
) {
  try {
    const campaign =
      await getScheduledCommunicationById(
        getCampaignId(request)
      );

    return response.status(200).json({
      success: true,

      message:
        "Scheduled communication retrieved successfully.",

      campaign,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getScheduledCommunicationsOverview(
  request,
  response,
  next
) {
  try {
    const overview =
      await getScheduledCommunicationOverview();

    return response.status(200).json({
      success: true,

      message:
        "Scheduled communication overview retrieved successfully.",

      overview,
    });
  } catch (error) {
    return next(error);
  }
}

export async function scheduleCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await scheduleCommunicationCampaign({
        campaignId:
          getCampaignId(request),

        scheduledAt:
          request.body.scheduledAt,

        timezone:
          request.body.timezone,

        batchSize:
          parseOptionalNumber(
            request.body.batchSize
          ),

        delayBetweenBatchesSeconds:
          parseOptionalNumber(
            request.body
              .delayBetweenBatchesSeconds
          ),

        userId:
          getAuthenticatedUserId(
            request
          ),
      });

    return response.status(200).json({
      success: true,

      message:
        "Communication campaign scheduled successfully.",

      campaign,
    });
  } catch (error) {
    return next(error);
  }
}

export async function rescheduleCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await rescheduleCommunicationCampaign({
        campaignId:
          getCampaignId(request),

        scheduledAt:
          request.body.scheduledAt,

        timezone:
          request.body.timezone,

        batchSize:
          parseOptionalNumber(
            request.body.batchSize
          ),

        delayBetweenBatchesSeconds:
          parseOptionalNumber(
            request.body
              .delayBetweenBatchesSeconds
          ),

        userId:
          getAuthenticatedUserId(
            request
          ),
      });

    return response.status(200).json({
      success: true,

      message:
        "Communication campaign rescheduled successfully.",

      campaign,
    });
  } catch (error) {
    return next(error);
  }
}

export async function unscheduleCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await unscheduleCommunicationCampaign({
        campaignId:
          getCampaignId(request),

        userId:
          getAuthenticatedUserId(
            request
          ),
      });

    return response.status(200).json({
      success: true,

      message:
        "Communication campaign returned to draft successfully.",

      campaign,
    });
  } catch (error) {
    return next(error);
  }
}

export async function cancelScheduledCampaign(
  request,
  response,
  next
) {
  try {
    const campaign =
      await cancelScheduledCommunication({
        campaignId:
          getCampaignId(request),

        reason:
          request.body.reason ||
          "",

        userId:
          getAuthenticatedUserId(
            request
          ),
      });

    return response.status(200).json({
      success: true,

      message:
        "Scheduled communication cancelled successfully.",

      campaign,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listDueScheduledCommunications(
  request,
  response,
  next
) {
  try {
    const campaigns =
      await getDueScheduledCommunications({
        scheduledBefore:
          request.query.scheduledBefore ||
          new Date(),

        limit:
          parseOptionalNumber(
            request.query.limit
          ) || 100,
      });

    return response.status(200).json({
      success: true,

      message:
        "Due scheduled communications retrieved successfully.",

      count: campaigns.length,
      campaigns,
    });
  } catch (error) {
    return next(error);
  }
}