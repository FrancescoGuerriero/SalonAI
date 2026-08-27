import twilio from "twilio";

import MessageDelivery
  from "../../../models/MessageDelivery.js";

import {
  updateDeliveryFromProviderEvent,
} from "../../../services/messageDeliveryRecordService.js";

const SUPPORTED_SMS_STATUSES =
  new Set([
    "accepted",
    "queued",
    "sending",
    "processing",
    "sent",
    "delivered",
    "undelivered",
    "failed",
    "cancelled",
  ]);

const TERMINAL_STATUSES =
  new Set([
    "delivered",
    "undelivered",
    "failed",
    "cancelled",
  ]);

const STATUS_RANK =
  new Map([
    ["pending", 0],
    ["accepted", 10],
    ["queued", 20],
    ["processing", 30],
    ["sending", 30],
    ["sent", 40],
    ["delivered", 50],
  ]);

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function lower(value) {
  return text(value)
    .toLowerCase();
}

function boolean(
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

  return [
    "true",
    "1",
    "yes",
    "on",
    "enabled",
  ].includes(
    lower(value)
  );
}

function normaliseStatus(
  value
) {
  const status =
    lower(value);

  if (
    status === "canceled"
  ) {
    return "cancelled";
  }

  return status;
}

function callbackUrl(
  request
) {
  const configured =
    text(
      process.env
        .TWILIO_STATUS_CALLBACK_URL
    );

  if (configured) {
    return configured;
  }

  const base =
    text(
      process.env
        .TWILIO_WEBHOOK_BASE_URL
    )
      .replace(
        /\/+$/,
        ""
      );

  if (base) {
    const originalUrl =
      text(
        request
          ?.originalUrl
      );

    const path =
      originalUrl
        .startsWith("/")
        ? originalUrl
        : `/${originalUrl}`;

    return `${base}${path}`;
  }

  const forwardedProtocol =
    text(
      request
        ?.headers
        ?.[
          "x-forwarded-proto"
        ]
    )
      .split(",")[0]
      .trim();

  const protocol =
    forwardedProtocol ||
    text(
      request?.protocol
    ) ||
    "https";

  const host =
    typeof request?.get ===
      "function"
      ? text(
          request.get(
            "host"
          )
        )
      : text(
          request
            ?.headers
            ?.host
        );

  const originalUrl =
    text(
      request
        ?.originalUrl
    );

  return (
    `${protocol}://${host}` +
    originalUrl
  );
}

function normaliseInteger(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(number)
  );
}

function normaliseErrorMessage(
  body = {}
) {
  return text(
    body.ErrorMessage ??
    body.errorMessage ??
    body.ChannelStatusMessage
  )
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      1000
    );
}

export function verifySmsStatusWebhookRequest(
  request
) {
  const production =
    lower(
      process.env.NODE_ENV
    ) === "production";

  const validationEnabled =
    boolean(
      process.env
        .TWILIO_WEBHOOK_VALIDATION_ENABLED,
      true
    );

  /*
   * Local development may explicitly disable
   * validation. Production never accepts unsigned
   * Twilio callbacks.
   */
  if (
    !production &&
    !validationEnabled
  ) {
    return true;
  }

  const signature =
    text(
      request
        ?.headers
        ?.[
          "x-twilio-signature"
        ]
    );

  const authToken =
    text(
      process.env
        .TWILIO_AUTH_TOKEN
    );

  if (
    !signature ||
    !authToken
  ) {
    return false;
  }

  return twilio.validateRequest(
    authToken,
    signature,
    callbackUrl(
      request
    ),
    request?.body || {}
  );
}

export function normaliseSmsStatusEvent(
  request
) {
  const body =
    request?.body || {};

  const providerMessageId =
    text(
      body.MessageSid ??
      body.SmsMessageSid ??
      body.SmsSid ??
      body.providerMessageId
    )
      .slice(
        0,
        160
      );

  if (!providerMessageId) {
    return {
      valid: false,
      reason:
        "missing_provider_message_id",
    };
  }

  const providerStatus =
    normaliseStatus(
      body.MessageStatus ??
      body.SmsStatus ??
      body.providerStatus
    );

  if (
    !SUPPORTED_SMS_STATUSES
      .has(
        providerStatus
      )
  ) {
    return {
      valid: false,
      reason:
        "unsupported_status",
      providerMessageId,
      providerStatus,
    };
  }

  const errorCode =
    text(
      body.ErrorCode ??
      body.errorCode
    );

  const errorMessage =
    normaliseErrorMessage(
      body
    );

  const price =
    body.Price ??
    body.price ??
    null;

  const priceUnit =
    text(
      body.PriceUnit ??
      body.priceUnit ??
      body.Currency ??
      body.currency
    );

  const segments =
    normaliseInteger(
      body.NumSegments ??
      body.numSegments
    );

  return {
    valid: true,

    providerMessageId,
    providerStatus,

    errorCode:
      errorCode || null,

    errorMessage,

    price,

    priceUnit,

    segments,

    providerResponse: {
      messageSid:
        providerMessageId,

      messageStatus:
        providerStatus,

      errorCode:
        errorCode || null,

      errorMessage:
        errorMessage || "",

      numSegments:
        segments,

      price,

      priceUnit:
        priceUnit || "",
    },
  };
}

export function decideSmsDeliveryStatusUpdate(
  currentValue,
  incomingValue
) {
  const current =
    normaliseStatus(
      currentValue
    );

  const incoming =
    normaliseStatus(
      incomingValue
    );

  if (
    !SUPPORTED_SMS_STATUSES
      .has(
        incoming
      )
  ) {
    return {
      action: "ignore",
      reason:
        "unsupported_status",
    };
  }

  if (
    current === incoming
  ) {
    return {
      action: "ignore",
      reason: "duplicate",
    };
  }

  /*
   * Once a terminal state is stored, stale
   * callbacks cannot change it.
   */
  if (
    TERMINAL_STATUSES
      .has(
        current
      )
  ) {
    return {
      action: "ignore",
      reason:
        "terminal_status",
    };
  }

  const currentRank =
    STATUS_RANK.get(
      current
    ) ?? -1;

  /*
   * Twilio can report undelivered after a send
   * attempt. That is a valid terminal transition
   * unless delivered was already recorded.
   */
  if (
    incoming ===
    "undelivered"
  ) {
    return {
      action: "update",
      reason:
        "delivery_failure",
    };
  }

  /*
   * failed/cancelled are valid before a completed
   * send. A delayed failure must not overwrite a
   * message already reported as sent.
   */
  if (
    incoming === "failed" ||
    incoming === "cancelled"
  ) {
    if (
      currentRank >=
      STATUS_RANK.get(
        "sent"
      )
    ) {
      return {
        action: "ignore",
        reason:
          "status_regression",
      };
    }

    return {
      action: "update",
      reason:
        incoming ===
        "cancelled"
          ? "cancelled"
          : "failure",
    };
  }

  const incomingRank =
    STATUS_RANK.get(
      incoming
    ) ?? -1;

  if (
    incomingRank <=
    currentRank
  ) {
    return {
      action: "ignore",
      reason:
        "status_regression",
    };
  }

  return {
    action: "update",
    reason:
      "status_advanced",
  };
}

export async function processSmsStatusEvent(
  event,
  {
    DeliveryModel =
      MessageDelivery,

    updateDelivery =
      updateDeliveryFromProviderEvent,

    maxAttempts = 3,
  } = {}
) {
  if (
    !event?.valid
  ) {
    return {
      matched: false,
      updated: false,
      ignored: true,
      duplicate: false,

      reason:
        event?.reason ||
        "invalid_status_callback",

      providerMessageId:
        event
          ?.providerMessageId ||
        "",

      providerStatus:
        event
          ?.providerStatus ||
        "",

      deliveryId: null,
    };
  }

  const safeMaxAttempts =
    Math.min(
      10,
      Math.max(
        1,
        Number(maxAttempts) ||
          3
      )
    );

  let lastError = null;

  for (
    let attempt = 0;
    attempt <
      safeMaxAttempts;
    attempt += 1
  ) {
    const record =
      await DeliveryModel
        .findByProviderMessageId(
          event
            .providerMessageId
        );

    if (!record) {
      return {
        matched: false,
        updated: false,
        ignored: true,
        duplicate: false,

        reason:
          "unknown_provider_message",

        providerMessageId:
          event
            .providerMessageId,

        providerStatus:
          event
            .providerStatus,

        deliveryId: null,
      };
    }

    if (
      lower(
        record.channel
      ) !== "sms"
    ) {
      return {
        matched: true,
        updated: false,
        ignored: true,
        duplicate: false,

        reason:
          "channel_mismatch",

        providerMessageId:
          event
            .providerMessageId,

        providerStatus:
          event
            .providerStatus,

        deliveryId:
          text(
            record.deliveryId ||
            record._id
          ) || null,
      };
    }

    const currentStatus =
      record.providerStatus ||
      record.status ||
      "";

    const decision =
      decideSmsDeliveryStatusUpdate(
        currentStatus,
        event.providerStatus
      );

    if (
      decision.action !==
      "update"
    ) {
      return {
        matched: true,
        updated: false,
        ignored: true,

        duplicate:
          decision.reason ===
          "duplicate",

        reason:
          decision.reason,

        providerMessageId:
          event
            .providerMessageId,

        providerStatus:
          event
            .providerStatus,

        deliveryId:
          text(
            record.deliveryId ||
            record._id
          ) || null,
      };
    }

    try {
      const updatedRecord =
        await updateDelivery({
          providerMessageId:
            event
              .providerMessageId,

          status:
            event
              .providerStatus,

          providerResponse:
            event
              .providerResponse,

          errorCode:
            event
              .errorCode,

          errorMessage:
            event
              .errorMessage,

          price:
            event
              .price,

          priceUnit:
            event
              .priceUnit,

          segments:
            event
              .segments,

          expectedVersion:
            record.__v ??
            null,
        });

      return {
        matched: true,
        updated: true,
        ignored: false,
        duplicate: false,

        reason:
          decision.reason,

        providerMessageId:
          event
            .providerMessageId,

        providerStatus:
          event
            .providerStatus,

        deliveryId:
          text(
            updatedRecord
              ?.deliveryId ||
            updatedRecord
              ?._id
          ) || null,
      };
    } catch (error) {
      lastError =
        error;

      const concurrencyConflict =
        error?.name ===
          "VersionError" ||
        error?.name ===
          "DeliveryStatusConflictError" ||
        error?.code ===
          "DELIVERY_STATUS_CONFLICT";

      if (
        concurrencyConflict &&
        attempt <
          safeMaxAttempts - 1
      ) {
        /*
         * Another callback updated the same delivery.
         * Reload the record and re-evaluate the latest
         * stored provider status before trying again.
         */
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ||
    new Error(
      "Unable to persist SMS delivery status."
    )
  );
}
function createHttpError(
  message,
  statusCode,
  code
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  error.status =
    statusCode;

  error.code =
    code;

  return error;
}

export async function receiveSmsStatusWebhook(
  request,
  response
) {
  if (
    !verifySmsStatusWebhookRequest(
      request
    )
  ) {
    throw createHttpError(
      "The Twilio SMS status webhook signature is invalid.",
      403,
      "SMS_WEBHOOK_SIGNATURE_INVALID"
    );
  }

  const event =
    normaliseSmsStatusEvent(
      request
    );

  const result =
    await processSmsStatusEvent(
      event
    );

  return response
    .status(200)
    .json({
      success: true,
      statusCallback: true,

      processed:
        result.updated
          ? 1
          : 0,

      ignored:
        result.ignored,

      duplicate:
        result.duplicate,

      reason:
        result.reason,

      providerMessageId:
        result
          .providerMessageId,

      providerStatus:
        result
          .providerStatus,

      deliveryId:
        result.deliveryId,
    });
}

export default {
  decideSmsDeliveryStatusUpdate,
  normaliseSmsStatusEvent,
  processSmsStatusEvent,
  receiveSmsStatusWebhook,
  verifySmsStatusWebhookRequest,
};
