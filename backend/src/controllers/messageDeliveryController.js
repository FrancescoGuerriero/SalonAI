import {
  getDeliveryConfigurationStatus,
  getDeliveryStatus,
  verifyAllDeliveryChannels,
  verifyDeliveryChannel,
} from "../services/messageDeliveryService.js";

import {
  cancelDeliveryRecord,
  deliverAndRecordMessage,
  findDeliveryRecord,
  getCampaignDeliverySummary,
  listDeliveryRecords,
  retryDeliveryRecord,
  retryDueDeliveryRecords,
  updateDeliveryFromProviderEvent,
} from "../services/messageDeliveryRecordService.js";

const MAX_BATCH_SIZE = 1000;
const DEFAULT_BATCH_CONCURRENCY = 5;

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
      "MESSAGE_DELIVERY_REQUEST_ERROR",
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

function getRequestIpAddress(
  request
) {
  const forwardedAddress =
    normaliseText(
      request.headers[
        "x-forwarded-for"
      ]
    );

  if (forwardedAddress) {
    return forwardedAddress
      .split(",")[0]
      .trim();
  }

  return (
    request.ip ||
    request.socket
      ?.remoteAddress ||
    ""
  );
}

function getRequestMetadata(
  request,
  suppliedMetadata = {}
) {
  const metadata =
    suppliedMetadata &&
    typeof suppliedMetadata ===
      "object" &&
    !Array.isArray(
      suppliedMetadata
    )
      ? suppliedMetadata
      : {};

  return {
    ...metadata,

    request: {
      ipAddress:
        getRequestIpAddress(
          request
        ),

      userAgent:
        normaliseText(
          request.headers[
            "user-agent"
          ]
        ),

      requestedAt:
        new Date().toISOString(),
    },
  };
}

function serialiseError(error) {
  return {
    message:
      error?.message ||
      "Message delivery failed.",

    code:
      error?.code ||
      "MESSAGE_DELIVERY_FAILED",

    statusCode:
      error?.statusCode ||
      500,

    retryable:
      Boolean(
        error?.retryable
      ),

    channel:
      error?.channel ||
      null,

    providerResponse:
      error?.providerResponse ||
      null,

    delivery:
      error?.delivery ||
      null,
  };
}

function validateBatchMessages(
  messages
) {
  if (!Array.isArray(messages)) {
    throw createControllerError(
      "The messages field must be an array.",
      {
        code:
          "INVALID_MESSAGE_BATCH",
      }
    );
  }

  if (messages.length === 0) {
    throw createControllerError(
      "The message batch cannot be empty.",
      {
        code:
          "EMPTY_MESSAGE_BATCH",
      }
    );
  }

  if (
    messages.length >
    MAX_BATCH_SIZE
  ) {
    throw createControllerError(
      `The message batch cannot contain more than ${MAX_BATCH_SIZE} messages.`,
      {
        code:
          "MESSAGE_BATCH_TOO_LARGE",
      }
    );
  }

  return messages;
}

async function runConcurrentBatch({
  messages,
  concurrency,
  stopOnError,
  processMessage,
}) {
  const results =
    new Array(messages.length);

  let nextIndex = 0;
  let stopped = false;

  async function worker() {
    while (true) {
      if (stopped) {
        return;
      }

      const currentIndex =
        nextIndex;

      nextIndex += 1;

      if (
        currentIndex >=
        messages.length
      ) {
        return;
      }

      try {
        const result =
          await processMessage(
            messages[
              currentIndex
            ],
            currentIndex
          );

        results[currentIndex] = {
          success: true,
          index: currentIndex,
          result,
        };
      } catch (error) {
        results[currentIndex] = {
          success: false,
          index: currentIndex,
          error:
            serialiseError(
              error
            ),
        };

        if (stopOnError) {
          stopped = true;
          return;
        }
      }
    }
  }

  const workerCount =
    Math.min(
      concurrency,
      messages.length
    );

  await Promise.all(
    Array.from(
      {
        length: workerCount,
      },
      () => worker()
    )
  );

  const completedResults =
    results.filter(Boolean);

  const successful =
    completedResults.filter(
      (result) =>
        result.success
    ).length;

  const failed =
    completedResults.filter(
      (result) =>
        !result.success
    ).length;

  return {
    success:
      failed === 0 &&
      completedResults.length ===
        messages.length,

    totalRequested:
      messages.length,

    totalProcessed:
      completedResults.length,

    totalSuccessful:
      successful,

    totalFailed:
      failed,

    totalSkipped:
      messages.length -
      completedResults.length,

    stoppedEarly: stopped,

    results:
      completedResults,
  };
}

async function getConfiguration(
  request,
  response,
  next
) {
  try {
    const configuration =
      getDeliveryConfigurationStatus();

    response.status(200).json({
      success: true,

      message:
        "Message-delivery configuration retrieved successfully.",

      ...configuration,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyChannel(
  request,
  response,
  next
) {
  try {
    const channel =
      normaliseText(
        request.params.channel
      );

    const verification =
      await verifyDeliveryChannel(
        channel
      );

    response.status(200).json({
      success: true,

      message:
        `${channel.toUpperCase()} delivery connection verified successfully.`,

      verification,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyAllChannels(
  request,
  response,
  next
) {
  try {
    const verification =
      await verifyAllDeliveryChannels();

    response
      .status(
        verification.success
          ? 200
          : 503
      )
      .json({
        success:
          verification.success,

        message:
          verification.success
            ? "All enabled delivery channels were verified successfully."
            : "One or more delivery channels could not be verified.",

        verification,
      });
  } catch (error) {
    next(error);
  }
}

async function sendMessage(
  request,
  response,
  next
) {
  try {
    const userId =
      getAuthenticatedUserId(
        request
      );

    const deliveryRequest = {
      ...request.body,

      metadata:
        getRequestMetadata(
          request,
          request.body
            ?.metadata
        ),

      createdBy: userId,
      updatedBy: userId,
    };

    const result =
      await deliverAndRecordMessage(
        deliveryRequest,
        {
          campaignId:
            request.body
              ?.campaignId,

          customerId:
            request.body
              ?.customerId,

          maximumAttempts:
            request.body
              ?.maximumAttempts,

          retryDelayMs:
            request.body
              ?.retryDelayMs,

          deferRetries:
            normaliseBoolean(
              request.body
                ?.deferRetries,
              false
            ),

          consent:
            request.body
              ?.consent,

          createdBy: userId,
          updatedBy: userId,

          metadata:
            getRequestMetadata(
              request,
              request.body
                ?.metadata
            ),
        }
      );

    const statusCode =
      result.skipped
        ? 202
        : 201;

    response
      .status(statusCode)
      .json({
        success:
          result.success,

        skipped:
          Boolean(
            result.skipped
          ),

        deferred:
          Boolean(
            result.deferred
          ),

        message:
          result.skipped
            ? "Message delivery was skipped because valid consent was not recorded."
            : result.deferred
              ? "Message delivery failed and has been scheduled for retry."
              : "Message delivered and recorded successfully.",

        delivery:
          result.delivery,

        result:
          result.result ||
          null,

        retryAt:
          result.retryAt ||
          null,
      });
  } catch (error) {
    next(error);
  }
}

async function sendMessageBatch(
  request,
  response,
  next
) {
  try {
    const messages =
      validateBatchMessages(
        request.body
          ?.messages
      );

    const concurrency =
      normaliseInteger(
        request.body
          ?.concurrency,
        DEFAULT_BATCH_CONCURRENCY,
        1,
        50
      );

    const stopOnError =
      normaliseBoolean(
        request.body
          ?.stopOnError,
        false
      );

    const userId =
      getAuthenticatedUserId(
        request
      );

    const batchResult =
      await runConcurrentBatch({
        messages,
        concurrency,
        stopOnError,

        processMessage:
          async (
            message,
            index
          ) =>
            deliverAndRecordMessage(
              {
                ...message,

                metadata:
                  getRequestMetadata(
                    request,
                    {
                      ...message
                        ?.metadata,

                      batchIndex:
                        index,
                    }
                  ),

                createdBy:
                  userId,

                updatedBy:
                  userId,
              },
              {
                campaignId:
                  message
                    ?.campaignId,

                customerId:
                  message
                    ?.customerId,

                maximumAttempts:
                  message
                    ?.maximumAttempts ??
                  request.body
                    ?.maximumAttempts,

                retryDelayMs:
                  message
                    ?.retryDelayMs ??
                  request.body
                    ?.retryDelayMs,

                deferRetries:
                  normaliseBoolean(
                    message
                      ?.deferRetries ??
                      request.body
                        ?.deferRetries,
                    false
                  ),

                consent:
                  message
                    ?.consent,

                createdBy:
                  userId,

                updatedBy:
                  userId,
              }
            ),
      });

    response
      .status(
        batchResult.success
          ? 201
          : 207
      )
      .json({
        success:
          batchResult.success,

        message:
          batchResult.success
            ? "All messages were delivered and recorded successfully."
            : "The message batch completed with one or more failures.",

        batch:
          batchResult,
      });
  } catch (error) {
    next(error);
  }
}

async function listDeliveries(
  request,
  response,
  next
) {
  try {
    const result =
      await listDeliveryRecords(
        {
          campaignId:
            request.query
              .campaignId,

          customerId:
            request.query
              .customerId,

          channel:
            request.query
              .channel,

          status:
            request.query
              .status,

          provider:
            request.query
              .provider,

          mode:
            request.query
              .mode,

          retryable:
            request.query
              .retryable,

          createdFrom:
            request.query
              .createdFrom,

          createdTo:
            request.query
              .createdTo,

          search:
            request.query
              .search,

          sortDirection:
            request.query
              .sortDirection,

          page:
            request.query
              .page,

          limit:
            request.query
              .limit,
        }
      );

    response.status(200).json({
      success: true,

      message:
        "Message-delivery records retrieved successfully.",

      deliveries:
        result.deliveries,

      pagination:
        result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

async function getDelivery(
  request,
  response,
  next
) {
  try {
    const delivery =
      await findDeliveryRecord(
        request.params
          .identifier
      );

    response.status(200).json({
      success: true,

      message:
        "Message-delivery record retrieved successfully.",

      delivery,
    });
  } catch (error) {
    next(error);
  }
}

async function retryDelivery(
  request,
  response,
  next
) {
  try {
    const result =
      await retryDeliveryRecord(
        request.params
          .identifier,
        {
          retryDelayMs:
            request.body
              ?.retryDelayMs,

          deferRetries:
            normaliseBoolean(
              request.body
                ?.deferRetries,
              false
            ),

          updatedBy:
            getAuthenticatedUserId(
              request
            ),
        }
      );

    response.status(200).json({
      success:
        result.success,

      deferred:
        Boolean(
          result.deferred
        ),

      message:
        result.deferred
          ? "Delivery retry failed and another retry was scheduled."
          : "Message delivery retried successfully.",

      delivery:
        result.delivery,

      result:
        result.result ||
        null,

      retryAt:
        result.retryAt ||
        null,
    });
  } catch (error) {
    next(error);
  }
}

async function retryDueDeliveries(
  request,
  response,
  next
) {
  try {
    const dueBefore =
      request.body
        ?.dueBefore
        ? new Date(
            request.body
              .dueBefore
          )
        : new Date();

    if (
      Number.isNaN(
        dueBefore.getTime()
      )
    ) {
      throw createControllerError(
        "dueBefore must be a valid date.",
        {
          code:
            "INVALID_DUE_DATE",
        }
      );
    }

    const result =
      await retryDueDeliveryRecords(
        {
          dueBefore,

          limit:
            request.body
              ?.limit,

          concurrency:
            request.body
              ?.concurrency,

          updatedBy:
            getAuthenticatedUserId(
              request
            ),
        }
      );

    response.status(200).json({
      success:
        result.success,

      message:
        result.success
          ? "Due message-delivery retries processed successfully."
          : "Due message-delivery retries completed with failures.",

      retryBatch:
        result,
    });
  } catch (error) {
    next(error);
  }
}

async function cancelDelivery(
  request,
  response,
  next
) {
  try {
    const delivery =
      await cancelDeliveryRecord(
        request.params
          .identifier,

        request.body
          ?.reason,

        getAuthenticatedUserId(
          request
        )
      );

    response.status(200).json({
      success: true,

      message:
        "Message delivery cancelled successfully.",

      delivery,
    });
  } catch (error) {
    next(error);
  }
}

async function getCampaignSummary(
  request,
  response,
  next
) {
  try {
    const summary =
      await getCampaignDeliverySummary(
        request.params
          .campaignId
      );

    response.status(200).json({
      success: true,

      message:
        "Campaign delivery summary retrieved successfully.",

      summary,
    });
  } catch (error) {
    next(error);
  }
}

async function getProviderStatus(
  request,
  response,
  next
) {
  try {
    const status =
      await getDeliveryStatus({
        channel:
          request.params
            .channel,

        providerMessageId:
          request.params
            .providerMessageId,
      });

    response.status(200).json({
      success: true,

      message:
        "Provider delivery status retrieved successfully.",

      status,
    });
  } catch (error) {
    next(error);
  }
}

async function receiveTwilioStatusWebhook(
  request,
  response,
  next
) {
  try {
    const providerMessageId =
      request.body
        ?.MessageSid ||
      request.body
        ?.SmsSid ||
      request.body
        ?.messageSid;

    const providerStatus =
      request.body
        ?.MessageStatus ||
      request.body
        ?.SmsStatus ||
      request.body
        ?.status;

    if (!providerMessageId) {
      throw createControllerError(
        "The Twilio webhook did not include a message SID.",
        {
          code:
            "TWILIO_MESSAGE_SID_REQUIRED",
        }
      );
    }

    if (!providerStatus) {
      throw createControllerError(
        "The Twilio webhook did not include a delivery status.",
        {
          code:
            "TWILIO_STATUS_REQUIRED",
        }
      );
    }

    const delivery =
      await updateDeliveryFromProviderEvent(
        {
          providerMessageId,
          status:
            providerStatus,

          errorCode:
            request.body
              ?.ErrorCode,

          errorMessage:
            request.body
              ?.ErrorMessage,

          price:
            request.body
              ?.Price,

          priceUnit:
            request.body
              ?.PriceUnit,

          segments:
            request.body
              ?.NumSegments,

          providerResponse: {
            ...request.body,

            receivedAt:
              new Date().toISOString(),

            ipAddress:
              getRequestIpAddress(
                request
              ),
          },
        }
      );

    response.status(200).json({
      success: true,

      message:
        "Twilio delivery status processed successfully.",

      deliveryId:
        delivery.deliveryId,

      status:
        delivery.status,
    });
  } catch (error) {
    next(error);
  }
}

export {
  cancelDelivery,
  getCampaignSummary,
  getConfiguration,
  getDelivery,
  getProviderStatus,
  listDeliveries,
  receiveTwilioStatusWebhook,
  retryDelivery,
  retryDueDeliveries,
  sendMessage,
  sendMessageBatch,
  verifyAllChannels,
  verifyChannel,
};