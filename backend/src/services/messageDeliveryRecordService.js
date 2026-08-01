import mongoose from "mongoose";

import MessageDelivery, {
  DELIVERY_STATUSES,
  TERMINAL_DELIVERY_STATUSES,
} from "../models/MessageDelivery.js";

import {
  getMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

import {
  deliverMessage,
  normaliseChannel,
} from "./messageDeliveryService.js";

const PROVIDER_STATUS_MAP = {
  pending: "pending",
  processing: "processing",
  accepted: "accepted",
  queued: "queued",
  scheduled: "queued",
  sending: "processing",
  sent: "sent",
  delivered: "delivered",
  partially_delivered:
    "partially_delivered",
  sandbox: "sandbox",
  skipped: "skipped",
  failed: "failed",
  undelivered: "undelivered",
  canceled: "cancelled",
  cancelled: "cancelled",
};

function createRecordServiceError(
  message,
  {
    statusCode = 500,
    code =
      "MESSAGE_DELIVERY_RECORD_ERROR",
    cause = null,
    delivery = null,
    retryable = false,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  error.delivery = delivery;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(
    value
  ).toLowerCase();
}

function normaliseObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return {
    ...value,
  };
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
    value === null
  ) {
    return fallback;
  }

  return Boolean(value);
}

function normaliseReference(value) {
  const reference =
    normaliseText(value);

  return reference || null;
}

function escapeRegularExpression(
  value
) {
  return String(value ?? "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function sleep(milliseconds) {
  const delay =
    normaliseInteger(
      milliseconds,
      0,
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

function calculateRetryDelay(
  baseDelayMs,
  attemptNumber
) {
  const baseDelay =
    normaliseInteger(
      baseDelayMs,
      0,
      0,
      3600000
    );

  if (baseDelay === 0) {
    return 0;
  }

  const multiplier = Math.pow(
    2,
    Math.max(
      0,
      attemptNumber - 1
    )
  );

  return Math.min(
    baseDelay * multiplier,
    3600000
  );
}

function serialiseDeliveryError(error) {
  return {
    code:
      normaliseText(
        error?.code
      ) ||
      "MESSAGE_DELIVERY_FAILED",

    message:
      normaliseText(
        error?.message
      ) ||
      "Message delivery failed.",

    statusCode:
      error?.statusCode ??
      500,

    providerCode:
      error?.providerResponse
        ?.providerCode ??
      error?.providerCode ??
      null,

    retryable:
      Boolean(
        error?.retryable
      ),

    details:
      error?.providerResponse ||
      error?.details ||
      null,
  };
}

function getProviderForChannel(
  channel,
  config
) {
  if (channel === "email") {
    return config.email.provider;
  }

  if (channel === "sms") {
    return config.sms.provider;
  }

  throw createRecordServiceError(
    `No provider is configured for channel: ${channel}.`,
    {
      statusCode: 400,
      code:
        "UNSUPPORTED_DELIVERY_CHANNEL",
    }
  );
}

function getRecipientFromRequest(
  request,
  channel
) {
  const recipient =
    normaliseObject(
      request.recipient
    );

  if (channel === "email") {
    const email =
      normaliseLowercase(
        recipient.email ||
          request.to
      );

    if (!email) {
      throw createRecordServiceError(
        "An email recipient is required.",
        {
          statusCode: 400,
          code:
            "EMAIL_RECIPIENT_REQUIRED",
        }
      );
    }

    return {
      name:
        normaliseText(
          recipient.name ||
            request.recipientName
        ),

      email,
      phone: "",
    };
  }

  const phone =
    normaliseText(
      recipient.phone ||
        request.to
    );

  if (!phone) {
    throw createRecordServiceError(
      "An SMS recipient phone number is required.",
      {
        statusCode: 400,
        code:
          "SMS_RECIPIENT_REQUIRED",
      }
    );
  }

  return {
    name:
      normaliseText(
        recipient.name ||
          request.recipientName
      ),

    email: "",
    phone,
  };
}

function getSenderForChannel(
  channel,
  config
) {
  if (channel === "email") {
    return {
      name:
        normaliseText(
          config.email.sender.name
        ),

      email:
        normaliseLowercase(
          config.email.sender.address
        ),

      phone: "",
    };
  }

  return {
    name:
      normaliseText(
        config.application.name
      ),

    email: "",

    phone:
      normaliseText(
        config.sms.twilio
          .fromNumber
      ),
  };
}

function getContentSnapshot(
  request,
  channel
) {
  if (channel === "email") {
    return {
      subject:
        normaliseText(
          request.subject
        ),

      text:
        normaliseText(
          request.text ??
            request.body
        ),

      html:
        normaliseText(
          request.html
        ),

      body: "",

      mediaUrls: [],
    };
  }

  const mediaUrls = [
    ...(Array.isArray(
      request.mediaUrls
    )
      ? request.mediaUrls
      : request.mediaUrls
        ? [request.mediaUrls]
        : []),

    ...(Array.isArray(
      request.mediaUrl
    )
      ? request.mediaUrl
      : request.mediaUrl
        ? [request.mediaUrl]
        : []),
  ]
    .map(normaliseText)
    .filter(Boolean);

  return {
    subject: "",
    text: "",
    html: "",

    body:
      normaliseText(
        request.body ??
          request.text
      ),

    mediaUrls:
      Array.from(
        new Set(mediaUrls)
      ),
  };
}

function resolveConsent(
  request,
  options,
  config
) {
  const suppliedConsent = {
    ...normaliseObject(
      request.consent
    ),

    ...normaliseObject(
      options.consent
    ),
  };

  const required =
    options.requireConsent ??
    suppliedConsent.required ??
    config.consent.required;

  if (!required) {
    return {
      required: false,
      checked: true,
      granted: true,

      source:
        normaliseText(
          suppliedConsent.source
        ) ||
        "consent_not_required",

      checkedAt: new Date(),
    };
  }

  return {
    required: true,

    checked:
      normaliseBoolean(
        suppliedConsent.checked,
        false
      ),

    granted:
      normaliseBoolean(
        suppliedConsent.granted,
        false
      ),

    source:
      normaliseText(
        suppliedConsent.source
      ),

    checkedAt:
      suppliedConsent.checked
        ? new Date()
        : null,
  };
}

function buildRecordData(
  request,
  options = {}
) {
  const config =
    getMessageDeliveryConfig();

  const channel =
    normaliseChannel(
      request.channel
    );

  const maximumAttempts =
    normaliseInteger(
      options.maximumAttempts ??
        request.maximumAttempts ??
        config.retry
          .maximumAttempts,
      config.retry
        .maximumAttempts,
      1,
      10
    );

  return {
    deliveryId:
      normaliseText(
        request.deliveryId
      ) || undefined,

    campaign:
      normaliseReference(
        options.campaignId ??
          request.campaignId ??
          request.campaign
      ),

    customer:
      normaliseReference(
        options.customerId ??
          request.customerId ??
          request.customer
      ),

    channel,
    mode: config.mode,

    provider:
      getProviderForChannel(
        channel,
        config
      ),

    status: "pending",

    recipient:
      getRecipientFromRequest(
        request,
        channel
      ),

    sender:
      getSenderForChannel(
        channel,
        config
      ),

    contentSnapshot:
      getContentSnapshot(
        request,
        channel
      ),

    consent:
      resolveConsent(
        request,
        options,
        config
      ),

    maximumAttempts,

    metadata: {
      ...normaliseObject(
        request.metadata
      ),

      ...normaliseObject(
        options.metadata
      ),
    },

    createdBy:
      normaliseReference(
        options.createdBy ??
          request.createdBy
      ),

    updatedBy:
      normaliseReference(
        options.updatedBy ??
          request.updatedBy ??
          options.createdBy ??
          request.createdBy
      ),
  };
}

function buildRequestFromRecord(
  record
) {
  const commonRequest = {
    channel: record.channel,
    deliveryId: record.deliveryId,

    metadata: {
      ...normaliseObject(
        record.metadata
      ),

      deliveryRecordId:
        record._id.toString(),

      campaignId:
        record.campaign
          ? record.campaign.toString()
          : null,

      customerId:
        record.customer
          ? record.customer.toString()
          : null,
    },

    consent: {
      required:
        record.consent.required,

      checked:
        record.consent.checked,

      granted:
        record.consent.granted,

      source:
        record.consent.source,
    },
  };

  if (record.channel === "email") {
    return {
      ...commonRequest,

      to:
        record.recipient.email,

      subject:
        record.contentSnapshot
          .subject,

      text:
        record.contentSnapshot
          .text,

      html:
        record.contentSnapshot
          .html,
    };
  }

  return {
    ...commonRequest,

    to:
      record.recipient.phone,

    body:
      record.contentSnapshot
        .body,

    mediaUrls:
      record.contentSnapshot
        .mediaUrls,
  };
}

function isConsentGranted(record) {
  if (!record.consent.required) {
    return true;
  }

  return (
    record.consent.checked ===
      true &&
    record.consent.granted ===
      true
  );
}

function assertRecordCanBeDelivered(
  record
) {
  if (
    record.status === "cancelled"
  ) {
    throw createRecordServiceError(
      "Cancelled message deliveries cannot be processed.",
      {
        statusCode: 409,
        code:
          "DELIVERY_ALREADY_CANCELLED",

        delivery: record,
      }
    );
  }

  if (
    TERMINAL_DELIVERY_STATUSES.includes(
      record.status
    ) &&
    record.status !== "failed" &&
    record.status !==
      "undelivered"
  ) {
    throw createRecordServiceError(
      `Delivery is already in terminal status: ${record.status}.`,
      {
        statusCode: 409,
        code:
          "DELIVERY_ALREADY_COMPLETED",

        delivery: record,
      }
    );
  }

  if (
    record.attemptCount >=
    record.maximumAttempts
  ) {
    throw createRecordServiceError(
      "The maximum number of delivery attempts has been reached.",
      {
        statusCode: 409,
        code:
          "MAXIMUM_DELIVERY_ATTEMPTS_REACHED",

        delivery: record,
      }
    );
  }
}

async function createDeliveryRecord(
  request,
  options = {}
) {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    throw createRecordServiceError(
      "A valid message delivery request is required.",
      {
        statusCode: 400,
        code:
          "INVALID_DELIVERY_REQUEST",
      }
    );
  }

  const recordData =
    buildRecordData(
      request,
      options
    );

  try {
    return await MessageDelivery.create(
      recordData
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw createRecordServiceError(
        "A message delivery with this delivery ID already exists.",
        {
          statusCode: 409,
          code:
            "DUPLICATE_DELIVERY_ID",
          cause: error,
        }
      );
    }

    throw createRecordServiceError(
      error?.message ||
        "Unable to create the message-delivery record.",
      {
        statusCode: 500,
        code:
          "DELIVERY_RECORD_CREATION_FAILED",
        cause: error,
      }
    );
  }
}

async function findDeliveryRecord(
  identifier
) {
  const value =
    normaliseText(identifier);

  if (!value) {
    throw createRecordServiceError(
      "A delivery record identifier is required.",
      {
        statusCode: 400,
        code:
          "DELIVERY_IDENTIFIER_REQUIRED",
      }
    );
  }

  const conditions = [
    {
      deliveryId: value,
    },

    {
      providerMessageId: value,
    },
  ];

  if (
    mongoose.isValidObjectId(
      value
    )
  ) {
    conditions.unshift({
      _id: value,
    });
  }

  const record =
    await MessageDelivery.findOne({
      $or: conditions,
    });

  if (!record) {
    throw createRecordServiceError(
      "Message-delivery record not found.",
      {
        statusCode: 404,
        code:
          "DELIVERY_RECORD_NOT_FOUND",
      }
    );
  }

  return record;
}

async function markConsentSkipped(
  record
) {
  record.status = "skipped";

  record.failure = {
    code:
      "DELIVERY_CONSENT_NOT_GRANTED",

    message:
      "The message was not sent because valid recipient consent was not recorded.",

    statusCode: 403,
    providerCode: null,
    retryable: false,
    details: null,
  };

  record.retry.retryable =
    false;

  record.retry.nextRetryAt =
    null;

  record.completedAt =
    new Date();

  await record.save();

  return {
    success: false,
    skipped: true,

    reason:
      "consent_not_granted",

    delivery: record,
  };
}

async function processDeliveryRecord(
  record,
  request,
  options = {}
) {
  assertRecordCanBeDelivered(
    record
  );

  if (
    !isConsentGranted(record)
  ) {
    return markConsentSkipped(
      record
    );
  }

  const config =
    getMessageDeliveryConfig();

  const retryDelayMs =
    normaliseInteger(
      options.retryDelayMs ??
        config.retry.delayMs,
      config.retry.delayMs,
      0,
      3600000
    );

  const deferRetries =
    Boolean(
      options.deferRetries
    );

  let latestError = null;

  while (
    record.attemptCount <
    record.maximumAttempts
  ) {
    record.retry.nextRetryAt =
      null;

    record.retry.retryable =
      false;

    record.startAttempt();

    await record.save();

    try {
      const deliveryResult =
        await deliverMessage(
          {
            ...request,

            channel:
              record.channel,

            deliveryId:
              record.deliveryId,

            metadata: {
              ...normaliseObject(
                request.metadata
              ),

              deliveryRecordId:
                record._id.toString(),

              campaignId:
                record.campaign
                  ? record.campaign.toString()
                  : null,

              customerId:
                record.customer
                  ? record.customer.toString()
                  : null,
            },
          },
          {
            maximumAttempts: 1,
            retryDelayMs: 0,
          }
        );

      record.completeAttempt({
        status: "succeeded",

        providerMessageId:
          deliveryResult
            .providerMessageId ||
          deliveryResult.messageId,

        providerStatus:
          deliveryResult.status,

        response:
          deliveryResult,
      });

      record.markSuccessful(
        deliveryResult
      );

      if (options.updatedBy) {
        record.updatedBy =
          options.updatedBy;
      }

      await record.save();

      return {
        success: true,
        skipped: false,

        attempts:
          record.attemptCount,

        delivery: record,

        result:
          deliveryResult,
      };
    } catch (error) {
      latestError = error;

      const errorDetails =
        serialiseDeliveryError(
          error
        );

      const canRetry =
        errorDetails.retryable &&
        record.attemptCount <
          record.maximumAttempts;

      const retryDelay =
        canRetry
          ? calculateRetryDelay(
              retryDelayMs,
              record.attemptCount
            )
          : 0;

      const nextRetryAt =
        canRetry
          ? new Date(
              Date.now() +
                retryDelay
            )
          : null;

      record.completeAttempt({
        status: canRetry
          ? "retry_scheduled"
          : "failed",

        error: errorDetails,

        retryDelayMs:
          retryDelay,

        nextRetryAt,
      });

      record.markFailed(
        errorDetails,
        {
          retryDelayMs:
            retryDelay,

          nextRetryAt,
        }
      );

      if (options.updatedBy) {
        record.updatedBy =
          options.updatedBy;
      }

      await record.save();

      if (!canRetry) {
        break;
      }

      if (deferRetries) {
        return {
          success: false,
          skipped: false,
          deferred: true,

          retryAt:
            nextRetryAt,

          attempts:
            record.attemptCount,

          delivery: record,

          error: errorDetails,
        };
      }

      await sleep(retryDelay);
    }
  }

  throw createRecordServiceError(
    latestError?.message ||
      "Message delivery failed.",
    {
      statusCode:
        latestError?.statusCode ||
        500,

      code:
        latestError?.code ||
        "MESSAGE_DELIVERY_FAILED",

      cause: latestError,

      delivery: record,

      retryable:
        Boolean(
          latestError?.retryable
        ),
    }
  );
}

async function deliverAndRecordMessage(
  request,
  options = {}
) {
  const record =
    await createDeliveryRecord(
      request,
      options
    );

  return processDeliveryRecord(
    record,
    request,
    options
  );
}

async function retryDeliveryRecord(
  identifier,
  options = {}
) {
  const record =
    await findDeliveryRecord(
      identifier
    );

  if (
    ![
      "failed",
      "undelivered",
    ].includes(record.status)
  ) {
    throw createRecordServiceError(
      "Only failed or undelivered messages can be retried.",
      {
        statusCode: 409,
        code:
          "DELIVERY_NOT_RETRYABLE",

        delivery: record,
      }
    );
  }

  if (!record.canRetry) {
    throw createRecordServiceError(
      "This message delivery cannot be retried.",
      {
        statusCode: 409,
        code:
          "DELIVERY_RETRY_NOT_ALLOWED",

        delivery: record,
      }
    );
  }

  const request =
    buildRequestFromRecord(
      record
    );

  return processDeliveryRecord(
    record,
    request,
    options
  );
}

async function retryDueDeliveryRecords({
  dueBefore = new Date(),
  limit = 100,
  concurrency = 5,
  updatedBy = null,
} = {}) {
  const safeLimit =
    normaliseInteger(
      limit,
      100,
      1,
      1000
    );

  const workerCount =
    normaliseInteger(
      concurrency,
      5,
      1,
      50
    );

  const records =
    await MessageDelivery.findRetryable(
      {
        dueBefore,
        limit: safeLimit,
      }
    );

  const results =
    new Array(records.length);

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex =
        nextIndex;

      nextIndex += 1;

      if (
        currentIndex >=
        records.length
      ) {
        return;
      }

      const record =
        records[currentIndex];

      try {
        const result =
          await processDeliveryRecord(
            record,
            buildRequestFromRecord(
              record
            ),
            {
              deferRetries: true,
              updatedBy,
            }
          );

        results[currentIndex] = {
          success:
            result.success,

          deliveryId:
            record.deliveryId,

          result,
        };
      } catch (error) {
        results[currentIndex] = {
          success: false,

          deliveryId:
            record.deliveryId,

          error:
            serialiseDeliveryError(
              error
            ),
        };
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          workerCount,
          records.length
        ),
      },
      () => worker()
    )
  );

  const successful =
    results.filter(
      (result) =>
        result?.success
    ).length;

  const failed =
    results.filter(
      (result) =>
        result &&
        !result.success
    ).length;

  return {
    success: failed === 0,

    total:
      records.length,

    successful,
    failed,

    results:
      results.filter(Boolean),

    processedAt:
      new Date().toISOString(),
  };
}

function mapProviderStatus(status) {
  const providerStatus =
    normaliseLowercase(
      status
    );

  return (
    PROVIDER_STATUS_MAP[
      providerStatus
    ] || null
  );
}

async function updateDeliveryFromProviderEvent({
  providerMessageId,
  status,
  providerResponse = null,
  errorCode = null,
  errorMessage = "",
  price = null,
  priceUnit = "",
  segments = null,
} = {}) {
  const messageId =
    normaliseText(
      providerMessageId
    );

  if (!messageId) {
    throw createRecordServiceError(
      "A provider message ID is required.",
      {
        statusCode: 400,
        code:
          "PROVIDER_MESSAGE_ID_REQUIRED",
      }
    );
  }

  const mappedStatus =
    mapProviderStatus(status);

  if (!mappedStatus) {
    throw createRecordServiceError(
      `Unsupported provider delivery status: ${normaliseText(
        status
      ) || "unknown"}.`,
      {
        statusCode: 400,
        code:
          "UNSUPPORTED_PROVIDER_STATUS",
      }
    );
  }

  const record =
    await MessageDelivery.findByProviderMessageId(
      messageId
    );

  if (!record) {
    throw createRecordServiceError(
      "No delivery record matches the provider message ID.",
      {
        statusCode: 404,
        code:
          "DELIVERY_RECORD_NOT_FOUND",
      }
    );
  }

  record.providerStatus =
    normaliseLowercase(
      status
    );

  record.providerResponse =
    providerResponse ||
    record.providerResponse;

  record.status =
    mappedStatus;

  if (price !== null) {
    record.metrics.price =
      normaliseText(price);
  }

  if (priceUnit) {
    record.metrics.priceUnit =
      normaliseText(
        priceUnit
      ).toUpperCase();
  }

  if (
    segments !== null &&
    Number.isFinite(
      Number(segments)
    )
  ) {
    record.metrics.segments =
      Number(segments);
  }

  if (
    [
      "failed",
      "undelivered",
      "cancelled",
    ].includes(mappedStatus)
  ) {
    record.failure = {
      code:
        normaliseText(
          errorCode
        ) ||
        `PROVIDER_${mappedStatus.toUpperCase()}`,

      message:
        normaliseText(
          errorMessage
        ) ||
        `The provider reported the message as ${mappedStatus}.`,

      statusCode: null,

      providerCode:
        errorCode ?? null,

      retryable: false,

      details:
        providerResponse,
    };

    record.retry.retryable =
      false;

    record.retry.nextRetryAt =
      null;
  }

  await record.save();

  return record;
}

async function listDeliveryRecords(
  filters = {}
) {
  const page =
    normaliseInteger(
      filters.page,
      1,
      1,
      1000000
    );

  const limit =
    normaliseInteger(
      filters.limit,
      20,
      1,
      100
    );

  const query = {};

  if (filters.campaignId) {
    query.campaign =
      filters.campaignId;
  }

  if (filters.customerId) {
    query.customer =
      filters.customerId;
  }

  if (filters.channel) {
    query.channel =
      normaliseChannel(
        filters.channel
      );
  }

  if (
    filters.status &&
    filters.status !== "all"
  ) {
    const status =
      normaliseLowercase(
        filters.status
      );

    if (
      !DELIVERY_STATUSES.includes(
        status
      )
    ) {
      throw createRecordServiceError(
        `Invalid delivery status: ${status}.`,
        {
          statusCode: 400,
          code:
            "INVALID_DELIVERY_STATUS",
        }
      );
    }

    query.status = status;
  }

  if (filters.provider) {
    query.provider =
      normaliseLowercase(
        filters.provider
      );
  }

  if (filters.mode) {
    query.mode =
      normaliseLowercase(
        filters.mode
      );
  }

  if (
    filters.retryable !==
    undefined
  ) {
    query["retry.retryable"] =
      normaliseBoolean(
        filters.retryable
      );
  }

  if (
    filters.createdFrom ||
    filters.createdTo
  ) {
    query.createdAt = {};

    if (filters.createdFrom) {
      query.createdAt.$gte =
        new Date(
          filters.createdFrom
        );
    }

    if (filters.createdTo) {
      query.createdAt.$lte =
        new Date(
          filters.createdTo
        );
    }
  }

  const search =
    normaliseText(
      filters.search
    );

  if (search) {
    const expression =
      new RegExp(
        escapeRegularExpression(
          search
        ),
        "i"
      );

    query.$or = [
      {
        deliveryId:
          expression,
      },

      {
        providerMessageId:
          expression,
      },

      {
        "recipient.name":
          expression,
      },

      {
        "recipient.email":
          expression,
      },

      {
        "recipient.phone":
          expression,
      },

      {
        "contentSnapshot.subject":
          expression,
      },
    ];
  }

  const sortDirection =
    normaliseLowercase(
      filters.sortDirection
    ) === "asc"
      ? 1
      : -1;

  const [
    deliveries,
    total,
  ] = await Promise.all([
    MessageDelivery.find(query)
      .populate(
        "campaign",
        "name channel status"
      )
      .populate(
        "customer",
        "name firstName lastName email phone"
      )
      .sort({
        createdAt:
          sortDirection,
      })
      .skip(
        (page - 1) * limit
      )
      .limit(limit),

    MessageDelivery.countDocuments(
      query
    ),
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(total / limit)
    );

  return {
    deliveries,

    pagination: {
      page,
      limit,
      total,
      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1,
    },
  };
}

async function getCampaignDeliverySummary(
  campaignId
) {
  if (
    !mongoose.isValidObjectId(
      campaignId
    )
  ) {
    throw createRecordServiceError(
      "A valid campaign ID is required.",
      {
        statusCode: 400,
        code:
          "INVALID_CAMPAIGN_ID",
      }
    );
  }

  const summary =
    await MessageDelivery.getCampaignSummary(
      campaignId
    );

  const result =
    summary[0] || {
      total: 0,
      statusCounts: [],
    };

  return {
    campaignId:
      String(campaignId),

    total:
      result.total || 0,

    statusCounts:
      Object.fromEntries(
        (
          result.statusCounts ||
          []
        ).map((entry) => [
          entry.status,
          entry.count,
        ])
      ),
  };
}

async function cancelDeliveryRecord(
  identifier,
  reason = "",
  updatedBy = null
) {
  const record =
    await findDeliveryRecord(
      identifier
    );

  if (
    TERMINAL_DELIVERY_STATUSES.includes(
      record.status
    )
  ) {
    throw createRecordServiceError(
      `A delivery in ${record.status} status cannot be cancelled.`,
      {
        statusCode: 409,
        code:
          "DELIVERY_CANNOT_BE_CANCELLED",

        delivery: record,
      }
    );
  }

  record.cancel(reason);

  if (updatedBy) {
    record.updatedBy =
      updatedBy;
  }

  await record.save();

  return record;
}

export {
  buildRequestFromRecord,
  cancelDeliveryRecord,
  createDeliveryRecord,
  createRecordServiceError,
  deliverAndRecordMessage,
  findDeliveryRecord,
  getCampaignDeliverySummary,
  listDeliveryRecords,
  processDeliveryRecord,
  retryDeliveryRecord,
  retryDueDeliveryRecords,
  updateDeliveryFromProviderEvent,
};

export default deliverAndRecordMessage;