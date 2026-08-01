import {
  getDueCampaigns,
  previewCampaignAudience,
  processCampaignDelivery,
  processDueCampaigns,
} from "../services/campaignDeliveryService.js";

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.floor(number)
    )
  );
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
    normaliseText(value).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
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
    ].includes(normalisedValue)
  ) {
    return false;
  }

  return fallback;
}

function createControllerError(
  message,
  {
    statusCode = 400,
    code =
      "CAMPAIGN_DELIVERY_REQUEST_ERROR",
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
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

function parseDate(
  value,
  {
    fieldName,
    fallback = null,
  }
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createControllerError(
      `${fieldName} must be a valid date.`,
      {
        code:
          "INVALID_CAMPAIGN_DELIVERY_DATE",
      }
    );
  }

  return date;
}

function buildAudiencePreviewOptions(
  request
) {
  return {
    maximumRecipients:
      normaliseInteger(
        request.query
          ?.maximumRecipients ??
          request.body
            ?.maximumRecipients,
        10000,
        1,
        10000
      ),

    consentRequired:
      normaliseBoolean(
        request.query
          ?.consentRequired ??
          request.body
            ?.consentRequired,
        true
      ),

    excludeUnsubscribed:
      normaliseBoolean(
        request.query
          ?.excludeUnsubscribed ??
          request.body
            ?.excludeUnsubscribed,
        true
      ),
  };
}

function buildCampaignDeliveryOptions(
  request
) {
  const body =
    request.body || {};

  return {
    batchSize:
      normaliseInteger(
        body.batchSize,
        100,
        1,
        1000
      ),

    delayBetweenBatchesSeconds:
      normaliseInteger(
        body
          .delayBetweenBatchesSeconds,
        0,
        0,
        86400
      ),

    concurrency:
      normaliseInteger(
        body.concurrency,
        5,
        1,
        50
      ),

    maximumRecipients:
      normaliseInteger(
        body.maximumRecipients,
        10000,
        1,
        10000
      ),

    maximumAttempts:
      normaliseInteger(
        body.maximumAttempts,
        3,
        1,
        10
      ),

    retryDelayMs:
      normaliseInteger(
        body.retryDelayMs,
        5000,
        0,
        3600000
      ),

    deferRetries:
      normaliseBoolean(
        body.deferRetries,
        true
      ),

    consentRequired:
      normaliseBoolean(
        body.consentRequired,
        true
      ),

    excludeUnsubscribed:
      normaliseBoolean(
        body.excludeUnsubscribed,
        true
      ),

    allowDraft:
      normaliseBoolean(
        body.allowDraft,
        false
      ),

    force:
      normaliseBoolean(
        body.force,
        false
      ),

    userId:
      getAuthenticatedUserId(
        request
      ),
  };
}

function serialiseCampaign(
  campaign
) {
  if (!campaign) {
    return null;
  }

  if (
    typeof campaign.toJSON ===
    "function"
  ) {
    return campaign.toJSON();
  }

  return campaign;
}

async function previewAudience(
  request,
  response,
  next
) {
  try {
    const preview =
      await previewCampaignAudience(
        request.params
          .campaignId,
        buildAudiencePreviewOptions(
          request
        )
      );

    response.status(200).json({
      success: true,

      message:
        "Campaign audience preview generated successfully.",

      preview,
    });
  } catch (error) {
    next(error);
  }
}

async function deliverCampaign(
  request,
  response,
  next
) {
  try {
    const result =
      await processCampaignDelivery(
        request.params
          .campaignId,
        buildCampaignDeliveryOptions(
          request
        )
      );

    const completedSuccessfully =
      result.campaign
        ?.status ===
      "completed";

    response
      .status(
        completedSuccessfully
          ? 200
          : 207
      )
      .json({
        success:
          completedSuccessfully,

        message:
          completedSuccessfully
            ? "Campaign delivered successfully."
            : "Campaign delivery completed with skipped, deferred or failed recipients.",

        campaign:
          serialiseCampaign(
            result.campaign
          ),

        summary:
          result.summary,
      });
  } catch (error) {
    next(error);
  }
}

async function listDueCampaigns(
  request,
  response,
  next
) {
  try {
    const dueBefore =
      parseDate(
        request.query
          ?.dueBefore,
        {
          fieldName:
            "dueBefore",

          fallback:
            new Date(),
        }
      );

    const limit =
      normaliseInteger(
        request.query?.limit,
        25,
        1,
        100
      );

    const campaigns =
      await getDueCampaigns({
        dueBefore,
        limit,
      });

    response.status(200).json({
      success: true,

      message:
        "Due communication campaigns retrieved successfully.",

      dueBefore:
        dueBefore.toISOString(),

      total:
        campaigns.length,

      campaigns:
        campaigns.map(
          serialiseCampaign
        ),
    });
  } catch (error) {
    next(error);
  }
}

async function processDueCampaignDeliveries(
  request,
  response,
  next
) {
  try {
    const body =
      request.body || {};

    const dueBefore =
      parseDate(
        body.dueBefore,
        {
          fieldName:
            "dueBefore",

          fallback:
            new Date(),
        }
      );

    const result =
      await processDueCampaigns({
        dueBefore,

        limit:
          normaliseInteger(
            body.limit,
            25,
            1,
            100
          ),

        concurrency:
          normaliseInteger(
            body.concurrency,
            2,
            1,
            10
          ),

        userId:
          getAuthenticatedUserId(
            request
          ),

        deliveryOptions: {
          batchSize:
            normaliseInteger(
              body.batchSize,
              100,
              1,
              1000
            ),

          delayBetweenBatchesSeconds:
            normaliseInteger(
              body
                .delayBetweenBatchesSeconds,
              0,
              0,
              86400
            ),

          concurrency:
            normaliseInteger(
              body
                .recipientConcurrency,
              5,
              1,
              50
            ),

          maximumRecipients:
            normaliseInteger(
              body
                .maximumRecipients,
              10000,
              1,
              10000
            ),

          maximumAttempts:
            normaliseInteger(
              body.maximumAttempts,
              3,
              1,
              10
            ),

          retryDelayMs:
            normaliseInteger(
              body.retryDelayMs,
              5000,
              0,
              3600000
            ),

          deferRetries:
            normaliseBoolean(
              body.deferRetries,
              true
            ),

          consentRequired:
            normaliseBoolean(
              body.consentRequired,
              true
            ),

          excludeUnsubscribed:
            normaliseBoolean(
              body
                .excludeUnsubscribed,
              true
            ),
        },
      });

    response
      .status(
        result.success
          ? 200
          : 207
      )
      .json({
        success:
          result.success,

        message:
          result.success
            ? "All due campaigns were processed successfully."
            : "Due campaign processing completed with one or more failures.",

        processing:
          result,
      });
  } catch (error) {
    next(error);
  }
}

export {
  deliverCampaign,
  listDueCampaigns,
  previewAudience,
  processDueCampaignDeliveries,
};