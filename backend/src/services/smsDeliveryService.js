import {
  getMessageDeliveryConfig,
  isValidE164Number,
  validateMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

const DEFAULT_SANDBOX_MESSAGE_PREFIX =
  "salonai-sandbox-sms";

const MAX_SMS_BODY_LENGTH = 1600;
const MAX_MEDIA_URLS = 10;

let twilioModule = null;
let twilioClientInstance = null;
let twilioClientSignature = "";

function createSmsDeliveryError(
  message,
  {
    statusCode = 500,
    code = "SMS_DELIVERY_ERROR",
    cause = null,
    retryable = false,
    providerResponse = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  error.providerResponse =
    providerResponse;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseCountryCode(value) {
  const suppliedCountryCode =
    normaliseText(value) || "+44";

  const countryAlias =
    suppliedCountryCode.toUpperCase();

  const countryCode =
    countryAlias === "GB" ||
    countryAlias === "UK"
      ? "+44"
      : suppliedCountryCode;

  const digits =
    countryCode.replace(/\D/g, "");

  if (!digits) {
    throw createSmsDeliveryError(
      "The default phone country code is invalid.",
      {
        statusCode: 500,
        code:
          "INVALID_DEFAULT_COUNTRY_CODE",
      }
    );
  }

  return `+${digits}`;
}

function normalisePhoneNumber(
  value,
  defaultCountryCode = "+44"
) {
  const rawValue =
    normaliseText(value);

  if (!rawValue) {
    throw createSmsDeliveryError(
      "A recipient phone number is required.",
      {
        statusCode: 400,
        code:
          "SMS_RECIPIENT_REQUIRED",
      }
    );
  }

  const countryCode =
    normaliseCountryCode(
      defaultCountryCode
    );

  const countryCodeDigits =
    countryCode.replace(/\D/g, "");

  let cleanedValue =
    rawValue.replace(
      /[\s\-().]/g,
      ""
    );

  if (
    cleanedValue.startsWith("00")
  ) {
    cleanedValue =
      `+${cleanedValue.slice(2)}`;
  }

  let normalisedNumber;

  if (
    cleanedValue.startsWith("+")
  ) {
    normalisedNumber =
      `+${cleanedValue
        .slice(1)
        .replace(/\D/g, "")}`;
  } else {
    let digits =
      cleanedValue.replace(
        /\D/g,
        ""
      );

    if (
      digits.startsWith(
        countryCodeDigits
      )
    ) {
      normalisedNumber =
        `+${digits}`;
    } else {
      digits = digits.replace(
        /^0+/,
        ""
      );

      normalisedNumber =
        `${countryCode}${digits}`;
    }
  }

  if (
    !isValidE164Number(
      normalisedNumber
    )
  ) {
    throw createSmsDeliveryError(
      "The recipient phone number must be valid and use international E.164 format.",
      {
        statusCode: 400,
        code:
          "INVALID_SMS_RECIPIENT",
      }
    );
  }

  return normalisedNumber;
}

function normaliseUrl(
  value,
  fieldName
) {
  const text =
    normaliseText(value);

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);

    if (
      !["http:", "https:"].includes(
        url.protocol
      )
    ) {
      throw new Error(
        "Unsupported URL protocol."
      );
    }

    return url.toString();
  } catch {
    throw createSmsDeliveryError(
      `${fieldName} must be a valid HTTP or HTTPS URL.`,
      {
        statusCode: 400,
        code: "INVALID_SMS_URL",
      }
    );
  }
}

function normaliseMediaUrls(value) {
  const suppliedValues =
    Array.isArray(value)
      ? value
      : normaliseText(value)
        ? [value]
        : [];

  const mediaUrls =
    Array.from(
      new Set(
        suppliedValues
          .map((entry) =>
            normaliseUrl(
              entry,
              "Media URL"
            )
          )
          .filter(Boolean)
      )
    );

  if (
    mediaUrls.length >
    MAX_MEDIA_URLS
  ) {
    throw createSmsDeliveryError(
      `A message cannot contain more than ${MAX_MEDIA_URLS} media URLs.`,
      {
        statusCode: 400,
        code:
          "TOO_MANY_SMS_MEDIA_URLS",
      }
    );
  }

  return mediaUrls;
}

function normaliseSmsBody(value) {
  const body =
    normaliseText(value);

  if (!body) {
    throw createSmsDeliveryError(
      "SMS message content is required.",
      {
        statusCode: 400,
        code:
          "SMS_CONTENT_REQUIRED",
      }
    );
  }

  if (
    body.length >
    MAX_SMS_BODY_LENGTH
  ) {
    throw createSmsDeliveryError(
      `SMS message content cannot exceed ${MAX_SMS_BODY_LENGTH} characters.`,
      {
        statusCode: 400,
        code:
          "SMS_CONTENT_TOO_LONG",
      }
    );
  }

  return body;
}

function normaliseSmsMessage(
  {
    to,
    body,
    mediaUrls,
    mediaUrl,
    statusCallbackUrl,
    metadata,
  } = {},
  {
    defaultCountryCode = "+44",
    configuredStatusCallbackUrl = "",
  } = {}
) {
  const combinedMediaUrls = [
    ...(Array.isArray(mediaUrls)
      ? mediaUrls
      : mediaUrls
        ? [mediaUrls]
        : []),

    ...(Array.isArray(mediaUrl)
      ? mediaUrl
      : mediaUrl
        ? [mediaUrl]
        : []),
  ];

  return {
    to: normalisePhoneNumber(
      to,
      defaultCountryCode
    ),

    body:
      normaliseSmsBody(body),

    mediaUrls:
      normaliseMediaUrls(
        combinedMediaUrls
      ),

    statusCallbackUrl:
      normaliseUrl(
        statusCallbackUrl ||
          configuredStatusCallbackUrl,
        "SMS status callback URL"
      ),

    metadata:
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
        ? metadata
        : {},
  };
}

function createMessageIdentifier(
  prefix
) {
  const randomValue =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `${prefix}-${Date.now()}-${randomValue}`;
}

function getTwilioClientSignature(
  smsConfig
) {
  return JSON.stringify({
    accountSid:
      smsConfig.twilio.accountSid,

    authToken:
      smsConfig.twilio.authToken,
  });
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
    throw createSmsDeliveryError(
      "The Twilio package is not installed. Install it in the backend before enabling live SMS delivery.",
      {
        statusCode: 500,
        code:
          "TWILIO_PACKAGE_NOT_INSTALLED",
        cause: error,
      }
    );
  }
}

function validateLiveSmsConfiguration(
  config
) {
  const validation =
    validateMessageDeliveryConfig(
      config
    );

  const smsErrors =
    validation.channels?.sms
      ?.errors || [];

  if (smsErrors.length > 0) {
    throw createSmsDeliveryError(
      smsErrors.join(" "),
      {
        statusCode: 500,
        code:
          "INVALID_SMS_DELIVERY_CONFIGURATION",
      }
    );
  }
}

function assertSmsConfiguration(
  config
) {
  if (!config.sms.enabled) {
    throw createSmsDeliveryError(
      "SMS delivery is disabled.",
      {
        statusCode: 503,
        code:
          "SMS_DELIVERY_DISABLED",
      }
    );
  }

  if (
    config.sms.provider !==
    "twilio"
  ) {
    throw createSmsDeliveryError(
      `Unsupported SMS provider: ${config.sms.provider}.`,
      {
        statusCode: 500,
        code:
          "UNSUPPORTED_SMS_PROVIDER",
      }
    );
  }

  /*
   * Sandbox mode intentionally does not
   * require genuine Twilio credentials.
   */
  if (config.mode === "live") {
    validateLiveSmsConfiguration(
      config
    );
  }

  return config.sms;
}

async function createTwilioClient(
  smsConfig
) {
  const twilio =
    await loadTwilioModule();

  return twilio(
    smsConfig.twilio.accountSid,
    smsConfig.twilio.authToken,
    {
      lazyLoading: true,
      autoRetry: false,
    }
  );
}

async function getTwilioClient(
  smsConfig
) {
  const signature =
    getTwilioClientSignature(
      smsConfig
    );

  if (
    twilioClientInstance &&
    twilioClientSignature ===
      signature
  ) {
    return twilioClientInstance;
  }

  twilioClientInstance =
    await createTwilioClient(
      smsConfig
    );

  twilioClientSignature =
    signature;

  return twilioClientInstance;
}

function createSandboxResponse({
  message,
  smsConfig,
}) {
  const providerMessageId =
    createMessageIdentifier(
      DEFAULT_SANDBOX_MESSAGE_PREFIX
    );

  return {
    success: true,
    mode: "sandbox",
    channel: "sms",
    provider:
      smsConfig.provider,

    messageId:
      providerMessageId,

    providerMessageId,

    status: "sandbox",

    to: message.to,

    from:
      smsConfig.twilio.fromNumber ||
      null,

    messagingServiceSid:
      smsConfig.twilio
        .messagingServiceSid ||
      null,

    body: message.body,

    mediaUrls:
      message.mediaUrls,

    segments: null,

    price: null,
    priceUnit: null,

    errorCode: null,
    errorMessage: null,

    response:
      "SMS accepted by the SalonAI sandbox. No external text message was sent.",

    metadata:
      message.metadata,

    sentAt:
      new Date().toISOString(),
  };
}

function buildTwilioMessagePayload({
  message,
  smsConfig,
}) {
  const payload = {
    to: message.to,
    body: message.body,
  };

  if (
    smsConfig.twilio
      .messagingServiceSid
  ) {
    payload.messagingServiceSid =
      smsConfig.twilio
        .messagingServiceSid;
  } else {
    payload.from =
      smsConfig.twilio
        .fromNumber;
  }

  if (
    message.mediaUrls.length > 0
  ) {
    payload.mediaUrl =
      message.mediaUrls;
  }

  if (
    message.statusCallbackUrl
  ) {
    payload.statusCallback =
      message.statusCallbackUrl;
  }

  return payload;
}

function classifyTwilioError(error) {
  const statusCode = Number(
    error?.status
  );

  const providerCode = Number(
    error?.code
  );

  const retryable =
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500 ||
    [
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "EHOSTUNREACH",
      "ENETUNREACH",
    ].includes(
      normaliseText(
        error?.cause?.code ||
          error?.code
      ).toUpperCase()
    );

  return {
    statusCode:
      Number.isFinite(statusCode)
        ? statusCode
        : null,

    providerCode:
      Number.isFinite(providerCode)
        ? providerCode
        : null,

    moreInfo:
      normaliseText(
        error?.moreInfo
      ) || null,

    details:
      error?.details || null,

    retryable,
  };
}

function mapTwilioMessageResponse(
  providerMessage,
  metadata
) {
  const errorCode =
    providerMessage.errorCode ??
    null;

  const errorMessage =
    providerMessage.errorMessage ??
    null;

  return {
    success:
      !errorCode,

    mode: "live",
    channel: "sms",
    provider: "twilio",

    messageId:
      providerMessage.sid,

    providerMessageId:
      providerMessage.sid,

    accountSid:
      providerMessage.accountSid ||
      null,

    messagingServiceSid:
      providerMessage
        .messagingServiceSid ||
      null,

    status:
      providerMessage.status ||
      "queued",

    direction:
      providerMessage.direction ||
      "outbound-api",

    to:
      providerMessage.to ||
      null,

    from:
      providerMessage.from ||
      null,

    body:
      providerMessage.body ||
      "",

    segments:
      providerMessage.numSegments
        ? Number(
            providerMessage.numSegments
          )
        : null,

    mediaCount:
      providerMessage.numMedia
        ? Number(
            providerMessage.numMedia
          )
        : 0,

    price:
      providerMessage.price ??
      null,

    priceUnit:
      providerMessage.priceUnit ??
      null,

    errorCode,
    errorMessage,

    providerCreatedAt:
      providerMessage.dateCreated ||
      null,

    providerUpdatedAt:
      providerMessage.dateUpdated ||
      null,

    metadata,

    sentAt:
      new Date().toISOString(),
  };
}

async function sendSms(
  smsMessage
) {
  const config =
    getMessageDeliveryConfig();

  const smsConfig =
    assertSmsConfiguration(
      config
    );

  const message =
    normaliseSmsMessage(
      smsMessage,
      {
        defaultCountryCode:
          smsConfig
            .defaultCountryCode,

        configuredStatusCallbackUrl:
          smsConfig.twilio
            .statusCallbackUrl,
      }
    );

  if (config.mode === "sandbox") {
    return createSandboxResponse({
      message,
      smsConfig,
    });
  }

  const client =
    await getTwilioClient(
      smsConfig
    );

  const providerPayload =
    buildTwilioMessagePayload({
      message,
      smsConfig,
    });

  try {
    const providerMessage =
      await client.messages.create(
        providerPayload
      );

    return mapTwilioMessageResponse(
      providerMessage,
      message.metadata
    );
  } catch (error) {
    const classification =
      classifyTwilioError(error);

    throw createSmsDeliveryError(
      error?.message ||
        "Twilio SMS delivery failed.",
      {
        statusCode:
          classification.statusCode &&
          classification.statusCode >=
            400
            ? 502
            : 500,

        code:
          classification.providerCode
            ? `TWILIO_${classification.providerCode}`
            : "TWILIO_SMS_DELIVERY_FAILED",

        cause: error,

        retryable:
          classification.retryable,

        providerResponse: {
          statusCode:
            classification.statusCode,

          providerCode:
            classification.providerCode,

          moreInfo:
            classification.moreInfo,

          details:
            classification.details,
        },
      }
    );
  }
}

function validateProviderMessageId(
  providerMessageId
) {
  const messageId =
    normaliseText(
      providerMessageId
    );

  if (!messageId) {
    throw createSmsDeliveryError(
      "A provider message ID is required.",
      {
        statusCode: 400,
        code:
          "SMS_MESSAGE_ID_REQUIRED",
      }
    );
  }

  if (
    messageId.length > 100
  ) {
    throw createSmsDeliveryError(
      "The provider message ID is invalid.",
      {
        statusCode: 400,
        code:
          "INVALID_SMS_MESSAGE_ID",
      }
    );
  }

  return messageId;
}

async function getSmsDeliveryStatus(
  providerMessageId
) {
  const config =
    getMessageDeliveryConfig();

  const smsConfig =
    assertSmsConfiguration(
      config
    );

  const messageId =
    validateProviderMessageId(
      providerMessageId
    );

  if (config.mode === "sandbox") {
    return {
      success: true,
      mode: "sandbox",
      channel: "sms",
      provider:
        smsConfig.provider,
      messageId,
      providerMessageId:
        messageId,
      status: "sandbox",
      errorCode: null,
      errorMessage: null,
      checkedAt:
        new Date().toISOString(),
    };
  }

  const client =
    await getTwilioClient(
      smsConfig
    );

  try {
    const providerMessage =
      await client
        .messages(messageId)
        .fetch();

    return {
      ...mapTwilioMessageResponse(
        providerMessage,
        {}
      ),

      checkedAt:
        new Date().toISOString(),
    };
  } catch (error) {
    const classification =
      classifyTwilioError(error);

    throw createSmsDeliveryError(
      error?.message ||
        "Unable to retrieve the SMS delivery status.",
      {
        statusCode:
          classification.statusCode ===
          404
            ? 404
            : 502,

        code:
          classification.statusCode ===
          404
            ? "SMS_MESSAGE_NOT_FOUND"
            : "TWILIO_STATUS_LOOKUP_FAILED",

        cause: error,

        retryable:
          classification.retryable,

        providerResponse: {
          statusCode:
            classification.statusCode,

          providerCode:
            classification.providerCode,

          moreInfo:
            classification.moreInfo,

          details:
            classification.details,
        },
      }
    );
  }
}

async function fetchTwilioAccount(
  client,
  accountSid
) {
  if (
    client.api?.v2010?.accounts
  ) {
    return client.api.v2010
      .accounts(accountSid)
      .fetch();
  }

  if (client.api?.accounts) {
    return client.api
      .accounts(accountSid)
      .fetch();
  }

  throw createSmsDeliveryError(
    "The installed Twilio package does not expose the expected Accounts API.",
    {
      statusCode: 500,
      code:
        "TWILIO_ACCOUNTS_API_UNAVAILABLE",
    }
  );
}

async function verifySmsDeliveryConnection() {
  const config =
    getMessageDeliveryConfig();

  const smsConfig =
    assertSmsConfiguration(
      config
    );

  if (config.mode === "sandbox") {
    return {
      success: true,
      mode: "sandbox",
      channel: "sms",
      provider:
        smsConfig.provider,

      message:
        "SMS sandbox configuration is active. Twilio was not contacted.",

      verifiedAt:
        new Date().toISOString(),
    };
  }

  const client =
    await getTwilioClient(
      smsConfig
    );

  try {
    const account =
      await fetchTwilioAccount(
        client,
        smsConfig.twilio
          .accountSid
      );

    return {
      success: true,
      mode: "live",
      channel: "sms",
      provider: "twilio",

      accountSid:
        account.sid ||
        smsConfig.twilio
          .accountSid,

      accountName:
        account.friendlyName ||
        null,

      accountStatus:
        account.status ||
        null,

      message:
        "Twilio connection verified successfully.",

      verifiedAt:
        new Date().toISOString(),
    };
  } catch (error) {
    if (
      error?.code ===
      "TWILIO_ACCOUNTS_API_UNAVAILABLE"
    ) {
      throw error;
    }

    const classification =
      classifyTwilioError(error);

    throw createSmsDeliveryError(
      error?.message ||
        "Twilio connection verification failed.",
      {
        statusCode: 502,
        code:
          "TWILIO_CONNECTION_VERIFICATION_FAILED",

        cause: error,

        retryable:
          classification.retryable,

        providerResponse: {
          statusCode:
            classification.statusCode,

          providerCode:
            classification.providerCode,

          moreInfo:
            classification.moreInfo,

          details:
            classification.details,
        },
      }
    );
  }
}

function closeSmsDeliveryConnection() {
  twilioClientInstance = null;
  twilioClientSignature = "";
}

export {
  closeSmsDeliveryConnection,
  createSmsDeliveryError,
  getSmsDeliveryStatus,
  normalisePhoneNumber,
  normaliseSmsMessage,
  sendSms,
  verifySmsDeliveryConnection,
};

export default sendSms;