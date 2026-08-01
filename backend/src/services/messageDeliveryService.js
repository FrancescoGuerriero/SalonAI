import {
  getMessageDeliveryConfig,
  getSafeMessageDeliveryConfig,
  validateMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

import {
  sendEmail,
  verifyEmailDeliveryConnection,
} from "./emailDeliveryService.js";

import {
  getSmsDeliveryStatus,
  sendSms,
  verifySmsDeliveryConnection,
} from "./smsDeliveryService.js";

const SUPPORTED_CHANNELS = [
  "email",
  "sms",
];

const SUCCESSFUL_SMS_STATUSES = [
  "queued",
  "accepted",
  "scheduled",
  "sending",
  "sent",
  "delivered",
  "sandbox",
];

const FAILED_SMS_STATUSES = [
  "failed",
  "undelivered",
  "canceled",
  "cancelled",
];

function createMessageDeliveryError(
  message,
  {
    statusCode = 500,
    code = "MESSAGE_DELIVERY_ERROR",
    cause = null,
    channel = null,
    retryable = false,
    providerResponse = null,
    attempt = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.channel = channel;
  error.retryable = retryable;
  error.providerResponse =
    providerResponse;
  error.attempt = attempt;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseChannel(value) {
  const channel =
    normaliseText(value).toLowerCase();

  if (!channel) {
    throw createMessageDeliveryError(
      "A message delivery channel is required.",
      {
        statusCode: 400,
        code:
          "MESSAGE_CHANNEL_REQUIRED",
      }
    );
  }

  if (
    !SUPPORTED_CHANNELS.includes(
      channel
    )
  ) {
    throw createMessageDeliveryError(
      `Unsupported message delivery channel: ${channel}.`,
      {
        statusCode: 400,
        code:
          "UNSUPPORTED_MESSAGE_CHANNEL",
        channel,
      }
    );
  }

  return channel;
}

function normalisePositiveInteger(
  value,
  fallback,
  minimum = 1,
  maximum = Number.MAX_SAFE_INTEGER
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

function normaliseNonNegativeInteger(
  value,
  fallback,
  maximum = Number.MAX_SAFE_INTEGER
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      0,
      Math.floor(number)
    )
  );
}

function sleep(milliseconds) {
  const delay =
    normaliseNonNegativeInteger(
      milliseconds,
      0,
      3600000
    );

  if (delay === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

function generateDeliveryId() {
  const randomValue =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `salonai-delivery-${Date.now()}-${randomValue}`;
}

function normaliseMetadata(metadata) {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return {};
  }

  return {
    ...metadata,
  };
}

function normaliseDeliveryRequest(
  request = {}
) {
  const channel =
    normaliseChannel(
      request.channel
    );

  const deliveryId =
    normaliseText(
      request.deliveryId
    ) || generateDeliveryId();

  const metadata = {
    ...normaliseMetadata(
      request.metadata
    ),

    deliveryId,
  };

  if (channel === "email") {
    return {
      channel,
      deliveryId,
      metadata,

      message: {
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        subject: request.subject,
        text:
          request.text ??
          request.body,
        html: request.html,
        replyTo:
          request.replyTo,
        headers:
          request.headers,
        attachments:
          request.attachments,
        metadata,
      },
    };
  }

  return {
    channel,
    deliveryId,
    metadata,

    message: {
      to: request.to,
      body:
        request.body ??
        request.text,
      mediaUrls:
        request.mediaUrls,
      mediaUrl:
        request.mediaUrl,
      statusCallbackUrl:
        request.statusCallbackUrl,
      metadata,
    },
  };
}

function normaliseProviderError(
  error,
  {
    channel,
    attempt,
  }
) {
  if (
    error?.code &&
    error?.statusCode
  ) {
    error.channel =
      error.channel || channel;

    error.attempt =
      error.attempt || attempt;

    return error;
  }

  return createMessageDeliveryError(
    error?.message ||
      `${channel} delivery failed.`,
    {
      statusCode: 500,
      code:
        "MESSAGE_PROVIDER_ERROR",
      cause: error,
      channel,
      retryable:
        Boolean(
          error?.retryable
        ),
      providerResponse:
        error?.providerResponse ||
        null,
      attempt,
    }
  );
}

function shouldRetryDelivery(
  error,
  attempt,
  maximumAttempts
) {
  return (
    Boolean(error?.retryable) &&
    attempt < maximumAttempts
  );
}

function calculateRetryDelay(
  baseDelayMs,
  attempt
) {
  const baseDelay =
    normaliseNonNegativeInteger(
      baseDelayMs,
      0,
      3600000
    );

  if (baseDelay === 0) {
    return 0;
  }

  const exponentialMultiplier =
    Math.pow(
      2,
      Math.max(0, attempt - 1)
    );

  const calculatedDelay =
    baseDelay *
    exponentialMultiplier;

  return Math.min(
    calculatedDelay,
    3600000
  );
}

function mapDeliveryResponse({
  deliveryId,
  channel,
  attempts,
  startedAt,
  providerResult,
}) {
  const completedAt =
    new Date();

  return {
    success:
      providerResult?.success !==
      false,

    deliveryId,
    channel,

    mode:
      providerResult?.mode ||
      null,

    provider:
      providerResult?.provider ||
      null,

    messageId:
      providerResult?.messageId ||
      null,

    providerMessageId:
      providerResult
        ?.providerMessageId ||
      null,

    status:
      providerResult?.status ||
      (providerResult?.success ===
      false
        ? "failed"
        : "accepted"),

    attempts,

    startedAt:
      startedAt.toISOString(),

    completedAt:
      completedAt.toISOString(),

    durationMs:
      completedAt.getTime() -
      startedAt.getTime(),

    result: providerResult,
  };
}

async function dispatchToProvider(
  deliveryRequest
) {
  if (
    deliveryRequest.channel ===
    "email"
  ) {
    return sendEmail(
      deliveryRequest.message
    );
  }

  if (
    deliveryRequest.channel ===
    "sms"
  ) {
    return sendSms(
      deliveryRequest.message
    );
  }

  throw createMessageDeliveryError(
    `No delivery provider is configured for ${deliveryRequest.channel}.`,
    {
      statusCode: 400,
      code:
        "DELIVERY_PROVIDER_NOT_FOUND",
      channel:
        deliveryRequest.channel,
    }
  );
}

async function deliverMessage(
  request,
  options = {}
) {
  const config =
    getMessageDeliveryConfig();

  const deliveryRequest =
    normaliseDeliveryRequest(
      request
    );

  const maximumAttempts =
    normalisePositiveInteger(
      options.maximumAttempts ??
        config.retry
          .maximumAttempts,
      3,
      1,
      10
    );

  const retryDelayMs =
    normaliseNonNegativeInteger(
      options.retryDelayMs ??
        config.retry.delayMs,
      5000,
      3600000
    );

  const startedAt =
    new Date();

  let attempt = 0;
  let latestError = null;

  while (
    attempt < maximumAttempts
  ) {
    attempt += 1;

    try {
      const providerResult =
        await dispatchToProvider(
          deliveryRequest
        );

      return mapDeliveryResponse({
        deliveryId:
          deliveryRequest
            .deliveryId,

        channel:
          deliveryRequest.channel,

        attempts: attempt,
        startedAt,
        providerResult,
      });
    } catch (error) {
      latestError =
        normaliseProviderError(
          error,
          {
            channel:
              deliveryRequest
                .channel,

            attempt,
          }
        );

      if (
        !shouldRetryDelivery(
          latestError,
          attempt,
          maximumAttempts
        )
      ) {
        break;
      }

      const delay =
        calculateRetryDelay(
          retryDelayMs,
          attempt
        );

      await sleep(delay);
    }
  }

  const completedAt =
    new Date();

  throw createMessageDeliveryError(
    latestError?.message ||
      "Message delivery failed.",
    {
      statusCode:
        latestError
          ?.statusCode || 500,

      code:
        latestError?.code ||
        "MESSAGE_DELIVERY_FAILED",

      cause:
        latestError?.cause ||
        latestError,

      channel:
        deliveryRequest.channel,

      retryable:
        Boolean(
          latestError?.retryable
        ),

      providerResponse:
        latestError
          ?.providerResponse ||
        null,

      attempt,

      completedAt:
        completedAt.toISOString(),

      durationMs:
        completedAt.getTime() -
        startedAt.getTime(),
    }
  );
}

function normaliseBatchRequests(
  requests
) {
  if (!Array.isArray(requests)) {
    throw createMessageDeliveryError(
      "Message delivery batch must be an array.",
      {
        statusCode: 400,
        code:
          "INVALID_MESSAGE_BATCH",
      }
    );
  }

  if (requests.length === 0) {
    throw createMessageDeliveryError(
      "Message delivery batch cannot be empty.",
      {
        statusCode: 400,
        code:
          "EMPTY_MESSAGE_BATCH",
      }
    );
  }

  if (requests.length > 1000) {
    throw createMessageDeliveryError(
      "A message delivery batch cannot contain more than 1,000 messages.",
      {
        statusCode: 400,
        code:
          "MESSAGE_BATCH_TOO_LARGE",
      }
    );
  }

  return requests;
}

async function deliverMessageBatch(
  requests,
  options = {}
) {
  const messages =
    normaliseBatchRequests(
      requests
    );

  const concurrency =
    normalisePositiveInteger(
      options.concurrency,
      5,
      1,
      50
    );

  const stopOnError =
    Boolean(
      options.stopOnError
    );

  const results =
    new Array(messages.length);

  let nextIndex = 0;
  let aborted = false;

  async function worker() {
    while (true) {
      if (aborted) {
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
        const delivery =
          await deliverMessage(
            messages[currentIndex],
            options
          );

        results[currentIndex] = {
          success: true,
          index: currentIndex,
          delivery,
        };
      } catch (error) {
        results[currentIndex] = {
          success: false,
          index: currentIndex,

          error: {
            message:
              error?.message ||
              "Message delivery failed.",

            code:
              error?.code ||
              "MESSAGE_DELIVERY_FAILED",

            statusCode:
              error?.statusCode ||
              500,

            channel:
              error?.channel ||
              messages[currentIndex]
                ?.channel ||
              null,

            retryable:
              Boolean(
                error?.retryable
              ),

            attempt:
              error?.attempt ||
              null,

            providerResponse:
              error
                ?.providerResponse ||
              null,
          },
        };

        if (stopOnError) {
          aborted = true;
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
    );

  const failed =
    completedResults.filter(
      (result) =>
        !result.success
    );

  return {
    success:
      failed.length === 0 &&
      completedResults.length ===
        messages.length,

    totalRequested:
      messages.length,

    totalProcessed:
      completedResults.length,

    totalSuccessful:
      successful.length,

    totalFailed:
      failed.length,

    totalSkipped:
      messages.length -
      completedResults.length,

    stoppedEarly:
      aborted,

    results:
      completedResults,
  };
}

async function verifyDeliveryChannel(
  channel
) {
  const normalisedChannel =
    normaliseChannel(channel);

  if (
    normalisedChannel ===
    "email"
  ) {
    return verifyEmailDeliveryConnection();
  }

  if (
    normalisedChannel ===
    "sms"
  ) {
    return verifySmsDeliveryConnection();
  }

  throw createMessageDeliveryError(
    `Unsupported verification channel: ${normalisedChannel}.`,
    {
      statusCode: 400,
      code:
        "UNSUPPORTED_VERIFICATION_CHANNEL",
      channel:
        normalisedChannel,
    }
  );
}

async function verifyAllDeliveryChannels() {
  const config =
    getMessageDeliveryConfig();

  const results = {};

  if (config.email.enabled) {
    try {
      results.email =
        await verifyEmailDeliveryConnection();
    } catch (error) {
      results.email = {
        success: false,

        error: {
          message:
            error?.message ||
            "Email verification failed.",

          code:
            error?.code ||
            "EMAIL_VERIFICATION_FAILED",
        },
      };
    }
  } else {
    results.email = {
      success: false,
      skipped: true,
      message:
        "Email delivery is disabled.",
    };
  }

  if (config.sms.enabled) {
    try {
      results.sms =
        await verifySmsDeliveryConnection();
    } catch (error) {
      results.sms = {
        success: false,

        error: {
          message:
            error?.message ||
            "SMS verification failed.",

          code:
            error?.code ||
            "SMS_VERIFICATION_FAILED",
        },
      };
    }
  } else {
    results.sms = {
      success: false,
      skipped: true,
      message:
        "SMS delivery is disabled.",
    };
  }

  return {
    success:
      Object.values(results)
        .filter(
          (result) =>
            !result.skipped
        )
        .every(
          (result) =>
            result.success
        ),

    mode: config.mode,
    channels: results,

    verifiedAt:
      new Date().toISOString(),
  };
}

async function getDeliveryStatus({
  channel,
  providerMessageId,
} = {}) {
  const normalisedChannel =
    normaliseChannel(channel);

  if (
    normalisedChannel ===
    "sms"
  ) {
    return getSmsDeliveryStatus(
      providerMessageId
    );
  }

  if (
    normalisedChannel ===
    "email"
  ) {
    throw createMessageDeliveryError(
      "Direct email delivery-status lookup is not available through SMTP. Delivery events must be received through provider webhooks.",
      {
        statusCode: 501,
        code:
          "EMAIL_STATUS_LOOKUP_UNAVAILABLE",
        channel: "email",
      }
    );
  }

  throw createMessageDeliveryError(
    `Delivery status lookup is unavailable for ${normalisedChannel}.`,
    {
      statusCode: 400,
      code:
        "DELIVERY_STATUS_LOOKUP_UNAVAILABLE",
      channel:
        normalisedChannel,
    }
  );
}

function getDeliveryConfigurationStatus() {
  const config =
    getMessageDeliveryConfig();

  const validation =
    validateMessageDeliveryConfig(
      config
    );

  const safeConfig =
    getSafeMessageDeliveryConfig();

  return {
    valid:
      validation.valid,

    mode: config.mode,

    enabledChannels: {
      email:
        config.email.enabled,
      sms: config.sms.enabled,
    },

    validation,
    configuration:
      safeConfig,

    checkedAt:
      new Date().toISOString(),
  };
}

function isSuccessfulSmsStatus(
  status
) {
  return SUCCESSFUL_SMS_STATUSES.includes(
    normaliseText(
      status
    ).toLowerCase()
  );
}

function isFailedSmsStatus(
  status
) {
  return FAILED_SMS_STATUSES.includes(
    normaliseText(
      status
    ).toLowerCase()
  );
}

export {
  FAILED_SMS_STATUSES,
  SUCCESSFUL_SMS_STATUSES,
  SUPPORTED_CHANNELS,
  createMessageDeliveryError,
  deliverMessage,
  deliverMessageBatch,
  getDeliveryConfigurationStatus,
  getDeliveryStatus,
  isFailedSmsStatus,
  isSuccessfulSmsStatus,
  normaliseChannel,
  verifyAllDeliveryChannels,
  verifyDeliveryChannel,
};

export default deliverMessage;