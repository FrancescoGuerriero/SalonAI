import {
  getMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

let twilioModule = null;

function createWebhookError(
  message,
  {
    statusCode = 403,
    code =
      "TWILIO_WEBHOOK_VALIDATION_ERROR",
    cause = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
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

function getFirstForwardedValue(value) {
  return normaliseText(value)
    .split(",")[0]
    .trim();
}

function removeTrailingSlash(value) {
  return normaliseText(value).replace(
    /\/+$/,
    ""
  );
}

function ensureLeadingSlash(value) {
  const path =
    normaliseText(value);

  if (!path) {
    return "/";
  }

  return path.startsWith("/")
    ? path
    : `/${path}`;
}

function getRequestProtocol(request) {
  const forwardedProtocol =
    getFirstForwardedValue(
      request.headers[
        "x-forwarded-proto"
      ]
    );

  if (forwardedProtocol) {
    return forwardedProtocol;
  }

  if (request.protocol) {
    return request.protocol;
  }

  return request.socket?.encrypted
    ? "https"
    : "http";
}

function getRequestHost(request) {
  const forwardedHost =
    getFirstForwardedValue(
      request.headers[
        "x-forwarded-host"
      ]
    );

  if (forwardedHost) {
    return forwardedHost;
  }

  return (
    normaliseText(
      request.headers.host
    ) ||
    normaliseText(
      request.get?.("host")
    )
  );
}

function getRequestPath(request) {
  return ensureLeadingSlash(
    request.originalUrl ||
      request.url ||
      request.path
  );
}

function getDerivedWebhookUrl(
  request
) {
  const protocol =
    getRequestProtocol(request);

  const host =
    getRequestHost(request);

  if (!host) {
    throw createWebhookError(
      "The webhook request host could not be determined.",
      {
        statusCode: 400,
        code:
          "TWILIO_WEBHOOK_HOST_UNAVAILABLE",
      }
    );
  }

  return `${protocol}://${host}${getRequestPath(
    request
  )}`;
}

function combineBaseUrlAndPath(
  baseUrl,
  requestPath
) {
  return `${removeTrailingSlash(
    baseUrl
  )}${ensureLeadingSlash(
    requestPath
  )}`;
}

function getExpectedWebhookUrl(
  request
) {
  /*
   * This should contain the exact public
   * URL configured in Twilio, including
   * any path and query parameters.
   */
  const exactWebhookUrl =
    normaliseText(
      process.env
        .TWILIO_STATUS_CALLBACK_URL
    );

  if (exactWebhookUrl) {
    return exactWebhookUrl;
  }

  /*
   * This can contain a public API origin,
   * for example:
   * https://api.example.com
   */
  const publicBaseUrl =
    normaliseText(
      process.env
        .TWILIO_WEBHOOK_BASE_URL
    );

  if (publicBaseUrl) {
    return combineBaseUrlAndPath(
      publicBaseUrl,
      getRequestPath(request)
    );
  }

  return getDerivedWebhookUrl(
    request
  );
}

function getTwilioSignature(
  request
) {
  return normaliseText(
    request.headers[
      "x-twilio-signature"
    ] ||
      request.get?.(
        "X-Twilio-Signature"
      )
  );
}

function getWebhookParameters(
  request
) {
  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  ) {
    return {};
  }

  /*
   * Do not select a fixed subset of
   * fields. Twilio can add webhook
   * parameters over time, and every
   * received form parameter must be
   * included in validation.
   */
  return {
    ...request.body,
  };
}

async function loadTwilioModule() {
  if (twilioModule) {
    return twilioModule;
  }

  try {
    const importedModule =
      await import("twilio");

    twilioModule =
      importedModule.default ||
      importedModule;

    return twilioModule;
  } catch (error) {
    throw createWebhookError(
      "The Twilio package is not installed. Install it before enabling webhook validation.",
      {
        statusCode: 500,
        code:
          "TWILIO_PACKAGE_NOT_INSTALLED",
        cause: error,
      }
    );
  }
}

function shouldValidateWebhook() {
  const config =
    getMessageDeliveryConfig();

  /*
   * Live mode always requires signature
   * validation. It cannot be disabled
   * through an environment flag.
   */
  if (config.mode === "live") {
    return true;
  }

  return normaliseBoolean(
    process.env
      .TWILIO_WEBHOOK_VALIDATION_ENABLED,
    false
  );
}

function getTwilioAuthToken() {
  return normaliseText(
    process.env
      .TWILIO_AUTH_TOKEN
  );
}

function attachValidationResult(
  request,
  validationResult
) {
  request.twilioWebhook = {
    ...validationResult,

    validatedAt:
      new Date().toISOString(),
  };
}

async function validateTwilioWebhook(
  request
) {
  const authToken =
    getTwilioAuthToken();

  if (!authToken) {
    throw createWebhookError(
      "TWILIO_AUTH_TOKEN is required for webhook signature validation.",
      {
        statusCode: 500,
        code:
          "TWILIO_AUTH_TOKEN_MISSING",
      }
    );
  }

  const signature =
    getTwilioSignature(request);

  if (!signature) {
    throw createWebhookError(
      "The X-Twilio-Signature header is missing.",
      {
        statusCode: 403,
        code:
          "TWILIO_SIGNATURE_MISSING",
      }
    );
  }

  const webhookUrl =
    getExpectedWebhookUrl(
      request
    );

  const parameters =
    getWebhookParameters(
      request
    );

  const twilio =
    await loadTwilioModule();

  if (
    typeof twilio.validateRequest !==
    "function"
  ) {
    throw createWebhookError(
      "The installed Twilio package does not expose validateRequest().",
      {
        statusCode: 500,
        code:
          "TWILIO_VALIDATOR_UNAVAILABLE",
      }
    );
  }

  let valid = false;

  try {
    valid = twilio.validateRequest(
      authToken,
      signature,
      webhookUrl,
      parameters
    );
  } catch (error) {
    throw createWebhookError(
      "Twilio webhook signature validation could not be completed.",
      {
        statusCode: 403,
        code:
          "TWILIO_SIGNATURE_VALIDATION_FAILED",
        cause: error,
      }
    );
  }

  if (!valid) {
    throw createWebhookError(
      "The Twilio webhook signature is invalid.",
      {
        statusCode: 403,
        code:
          "INVALID_TWILIO_SIGNATURE",
      }
    );
  }

  return {
    valid: true,
    skipped: false,
    signaturePresent: true,
    webhookUrl,
  };
}

async function twilioWebhookProtection(
  request,
  response,
  next
) {
  try {
    if (!shouldValidateWebhook()) {
      attachValidationResult(
        request,
        {
          valid: false,
          skipped: true,
          signaturePresent:
            Boolean(
              getTwilioSignature(
                request
              )
            ),

          reason:
            "Webhook validation is disabled in sandbox mode.",

          webhookUrl:
            getExpectedWebhookUrl(
              request
            ),
        }
      );

      next();
      return;
    }

    const validationResult =
      await validateTwilioWebhook(
        request
      );

    attachValidationResult(
      request,
      validationResult
    );

    next();
  } catch (error) {
    next(error);
  }
}

function requireValidatedTwilioWebhook(
  request,
  response,
  next
) {
  if (
    request.twilioWebhook
      ?.valid === true
  ) {
    next();
    return;
  }

  next(
    createWebhookError(
      "A validated Twilio webhook request is required.",
      {
        statusCode: 403,
        code:
          "VALIDATED_TWILIO_WEBHOOK_REQUIRED",
      }
    )
  );
}

export {
  createWebhookError,
  getExpectedWebhookUrl,
  getTwilioSignature,
  requireValidatedTwilioWebhook,
  shouldValidateWebhook,
  twilioWebhookProtection,
  validateTwilioWebhook,
};

export default twilioWebhookProtection;