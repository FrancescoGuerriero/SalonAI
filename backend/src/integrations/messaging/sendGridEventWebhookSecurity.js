import {
  createPublicKey,
  verify,
} from "node:crypto";

const SIGNATURE_HEADER =
  "x-twilio-email-event-webhook-signature";
const TIMESTAMP_HEADER =
  "x-twilio-email-event-webhook-timestamp";

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function createWebhookError(
  message,
  {
    statusCode = 403,
    code =
      "SENDGRID_WEBHOOK_SIGNATURE_INVALID",
  } = {}
) {
  const error =
    new Error(
      message
    );
  error.statusCode =
    statusCode;
  error.code =
    code;
  return error;
}

export function sendGridWebhookPublicKey(
  value
) {
  const supplied =
    text(value);

  if (!supplied) {
    throw createWebhookError(
      "SendGrid Event Webhook public key is not configured.",
      {
        statusCode: 503,
        code:
          "SENDGRID_WEBHOOK_PUBLIC_KEY_REQUIRED",
      }
    );
  }

  try {
    if (
      supplied.includes(
        "BEGIN PUBLIC KEY"
      )
    ) {
      return createPublicKey(
        supplied
      );
    }

    return createPublicKey({
      key:
        Buffer.from(
          supplied,
          "base64"
        ),
      format:
        "der",
      type:
        "spki",
    });
  } catch (cause) {
    const error =
      createWebhookError(
        "SendGrid Event Webhook public key is invalid.",
        {
          statusCode: 503,
          code:
            "SENDGRID_WEBHOOK_PUBLIC_KEY_INVALID",
        }
      );
    error.cause =
      cause;
    throw error;
  }
}

export function verifySendGridEventWebhookSignature({
  publicKey,
  rawBody,
  signature,
  timestamp,
} = {}) {
  if (
    !Buffer.isBuffer(
      rawBody
    )
  ) {
    return false;
  }

  const safeSignature =
    text(signature);
  const safeTimestamp =
    text(timestamp);

  if (
    !safeSignature ||
    !safeTimestamp
  ) {
    return false;
  }

  try {
    const key =
      sendGridWebhookPublicKey(
        publicKey
      );

    const signedPayload =
      Buffer.concat([
        Buffer.from(
          safeTimestamp,
          "utf8"
        ),
        rawBody,
      ]);

    return verify(
      "sha256",
      signedPayload,
      key,
      Buffer.from(
        safeSignature,
        "base64"
      )
    );
  } catch {
    return false;
  }
}

export function requireSendGridEventWebhookSignature(
  request,
  response,
  next
) {
  if (
    String(
      process.env
        .SENDGRID_EVENT_WEBHOOK_ENABLED ||
        ""
    )
      .trim()
      .toLowerCase() !==
    "true"
  ) {
    return next(
      createWebhookError(
        "SendGrid Event Webhook is disabled.",
        {
          statusCode: 503,
          code:
            "SENDGRID_EVENT_WEBHOOK_DISABLED",
        }
      )
    );
  }

  const rawBody =
    request.body;

  if (
    !Buffer.isBuffer(
      rawBody
    )
  ) {
    return next(
      createWebhookError(
        "SendGrid Event Webhook requires the original raw request body.",
        {
          statusCode: 400,
          code:
            "SENDGRID_WEBHOOK_RAW_BODY_REQUIRED",
        }
      )
    );
  }

  const valid =
    verifySendGridEventWebhookSignature({
      publicKey:
        process.env
          .SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY,
      rawBody,
      signature:
        request.headers[
          SIGNATURE_HEADER
        ],
      timestamp:
        request.headers[
          TIMESTAMP_HEADER
        ],
    });

  if (!valid) {
    return next(
      createWebhookError(
        "SendGrid Event Webhook signature is invalid."
      )
    );
  }

  return next();
}

export {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
};

export default {
  requireSendGridEventWebhookSignature,
  sendGridWebhookPublicKey,
  verifySendGridEventWebhookSignature,
};
