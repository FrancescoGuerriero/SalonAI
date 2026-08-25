const DELIVERY_MODES = Object.freeze({
  SANDBOX: "sandbox",
  LIVE: "live",
});

const EMAIL_PROVIDERS = Object.freeze({
  SMTP: "smtp",
});

const SMS_PROVIDERS = Object.freeze({
  TWILIO: "twilio",
});

const SANDBOX_ALIASES = new Set([
  "mock",
  "console",
  "demo",
  "sandbox",
]);

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(value).toLowerCase();
}

function normaliseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalisedValue = normaliseLowercase(value);

  if (["true", "1", "yes", "on", "enabled"].includes(normalisedValue)) {
    return true;
  }

  if (["false", "0", "no", "off", "disabled"].includes(normalisedValue)) {
    return false;
  }

  return fallback;
}

function normaliseInteger(value, fallback, minimum, maximum) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsedValue));
}

function normalisePhoneCountryCode(value) {
  const countryCode = normaliseText(value);

  if (!countryCode) {
    return "+44";
  }

  const countryAlias =
    countryCode.toUpperCase();

  if (
    countryAlias === "GB" ||
    countryAlias === "UK"
  ) {
    return "+44";
  }

  const digits =
    countryCode.replace(/\D/g, "");

  if (!digits) {
    return countryCode;
  }

  return `+${digits}`;
}

function normaliseDeliveryMode(value) {
  const mode = normaliseLowercase(value);

  if (!mode || SANDBOX_ALIASES.has(mode)) {
    return DELIVERY_MODES.SANDBOX;
  }

  return mode;
}

function resolveEmailProvider() {
  const provider = normaliseLowercase(process.env.EMAIL_PROVIDER);

  if (provider) {
    return provider;
  }

  const legacyMode = normaliseLowercase(process.env.EMAIL_PROVIDER_MODE);

  if (!legacyMode || SANDBOX_ALIASES.has(legacyMode) || legacyMode === "live") {
    return EMAIL_PROVIDERS.SMTP;
  }

  return legacyMode;
}

function resolveSmsProvider() {
  const provider = normaliseLowercase(process.env.SMS_PROVIDER);

  if (provider) {
    return provider;
  }

  const legacyMode = normaliseLowercase(process.env.SMS_PROVIDER_MODE);

  if (!legacyMode || SANDBOX_ALIASES.has(legacyMode) || legacyMode === "live") {
    return SMS_PROVIDERS.TWILIO;
  }

  return legacyMode;
}

function isValidEmailAddress(value) {
  const email = normaliseLowercase(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidE164Number(value) {
  return /^\+[1-9]\d{7,14}$/.test(normaliseText(value));
}

function createConfigurationError(
  message,
  {
    statusCode = 500,
    code = "MESSAGE_DELIVERY_CONFIGURATION_ERROR",
    channel = null,
    provider = null,
    details = null,
    cause = null,
  } = {}
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.channel = channel;
  error.provider = provider;
  error.details = details;
  error.retryable = false;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function getMessageDeliveryConfig() {
  const mode = normaliseDeliveryMode(process.env.MESSAGE_DELIVERY_MODE);

  const smtpUser = normaliseText(process.env.SMTP_USER);
  const smtpPassword = normaliseText(process.env.SMTP_PASSWORD);

  const emailFromName =
    normaliseText(process.env.EMAIL_FROM_NAME) ||
    normaliseText(process.env.APPLICATION_NAME) ||
    "SalonAI";

  const emailFromAddress = normaliseLowercase(
    process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || smtpUser
  );

  const emailReplyTo = normaliseLowercase(process.env.EMAIL_REPLY_TO);

  const connectionTimeoutMs = normaliseInteger(
    process.env.SMTP_CONNECTION_TIMEOUT_MS,
    15000,
    1000,
    120000
  );

  const greetingTimeoutMs = normaliseInteger(
    process.env.SMTP_GREETING_TIMEOUT_MS,
    15000,
    1000,
    120000
  );

  const socketTimeoutMs = normaliseInteger(
    process.env.SMTP_SOCKET_TIMEOUT_MS,
    30000,
    1000,
    300000
  );

  return {
    mode,
    sandbox: mode === DELIVERY_MODES.SANDBOX,
    live: mode === DELIVERY_MODES.LIVE,

    application: {
      name: normaliseText(process.env.APPLICATION_NAME) || "SalonAI",
      baseUrl:
        normaliseText(process.env.APPLICATION_BASE_URL) ||
        normaliseText(process.env.FRONTEND_URL) ||
        "http://localhost:5173",
      apiBaseUrl:
        normaliseText(process.env.API_BASE_URL) ||
        `http://localhost:${process.env.PORT || 5000}`,
    },

    consent: {
      required: normaliseBoolean(process.env.MESSAGE_CONSENT_REQUIRED, true),
      excludeUnsubscribed: normaliseBoolean(
        process.env.MESSAGE_EXCLUDE_UNSUBSCRIBED,
        true
      ),
    },

    retry: {
      maximumAttempts: normaliseInteger(
        process.env.MESSAGE_DELIVERY_MAX_ATTEMPTS,
        3,
        1,
        10
      ),
      delayMs: normaliseInteger(
        process.env.MESSAGE_DELIVERY_RETRY_DELAY_MS,
        5000,
        0,
        3600000
      ),
    },

    email: {
      enabled: normaliseBoolean(process.env.EMAIL_DELIVERY_ENABLED, false),
      provider: resolveEmailProvider(),
      batchSize: normaliseInteger(
        process.env.EMAIL_DELIVERY_BATCH_SIZE,
        100,
        1,
        1000
      ),
      from: {
        name: emailFromName,
        address: emailFromAddress,
      },
      sender: {
        name: emailFromName,
        address: emailFromAddress,
        replyTo: emailReplyTo,
      },
      fromName: emailFromName,
      fromAddress: emailFromAddress,
      replyTo: emailReplyTo,
      connectionTimeoutMs,
      greetingTimeoutMs,
      socketTimeoutMs,
      smtp: {
        host: normaliseText(process.env.SMTP_HOST),
        port: normaliseInteger(process.env.SMTP_PORT, 587, 1, 65535),
        secure: normaliseBoolean(process.env.SMTP_SECURE, false),
        requireTls: normaliseBoolean(process.env.SMTP_REQUIRE_TLS, true),
        rejectUnauthorized: normaliseBoolean(
          process.env.SMTP_REJECT_UNAUTHORIZED,
          true
        ),
        user: smtpUser,
        username: smtpUser,
        password: smtpPassword,
        auth:
          smtpUser || smtpPassword
            ? {
                user: smtpUser,
                pass: smtpPassword,
              }
            : undefined,
        connectionTimeoutMs,
        greetingTimeoutMs,
        socketTimeoutMs,
      },
    },

    sms: {
      enabled: normaliseBoolean(process.env.SMS_DELIVERY_ENABLED, false),
      provider: resolveSmsProvider(),
      batchSize: normaliseInteger(
        process.env.SMS_DELIVERY_BATCH_SIZE,
        100,
        1,
        1000
      ),
      defaultCountryCode: normalisePhoneCountryCode(
        process.env.DEFAULT_PHONE_COUNTRY_CODE
      ),
      twilio: {
        accountSid: normaliseText(process.env.TWILIO_ACCOUNT_SID),
        authToken: normaliseText(process.env.TWILIO_AUTH_TOKEN),
        fromNumber: normaliseText(
          process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_SMS_FROM
        ),
        messagingServiceSid: normaliseText(
          process.env.TWILIO_MESSAGING_SERVICE_SID
        ),
        statusCallbackUrl: normaliseText(process.env.TWILIO_STATUS_CALLBACK_URL),
        webhookBaseUrl: normaliseText(process.env.TWILIO_WEBHOOK_BASE_URL),
        webhookValidationEnabled:
          mode === DELIVERY_MODES.LIVE ||
          normaliseBoolean(process.env.TWILIO_WEBHOOK_VALIDATION_ENABLED, false),
      },
    },
  };
}

function validateEmailConfiguration(config, errors, warnings) {
  const emailConfig = config.email;

  if (!emailConfig.enabled) {
    warnings.push({
      channel: "email",
      code: "EMAIL_DELIVERY_DISABLED",
      message: "Email delivery is disabled.",
    });
    return;
  }

  if (!Object.values(EMAIL_PROVIDERS).includes(emailConfig.provider)) {
    errors.push({
      channel: "email",
      code: "UNSUPPORTED_EMAIL_PROVIDER",
      message: `Unsupported email provider: ${emailConfig.provider}.`,
    });
    return;
  }

  if (config.mode === DELIVERY_MODES.SANDBOX) {
    return;
  }

  if (!emailConfig.smtp.host) {
    errors.push({
      channel: "email",
      code: "SMTP_HOST_REQUIRED",
      message: "SMTP_HOST is required for live email delivery.",
    });
  }

  if (!emailConfig.smtp.user) {
    errors.push({
      channel: "email",
      code: "SMTP_USER_REQUIRED",
      message: "SMTP_USER is required for live email delivery.",
    });
  }

  if (!emailConfig.smtp.password) {
    errors.push({
      channel: "email",
      code: "SMTP_PASSWORD_REQUIRED",
      message: "SMTP_PASSWORD is required for live email delivery.",
    });
  }

  if (!emailConfig.from.address) {
    errors.push({
      channel: "email",
      code: "EMAIL_FROM_ADDRESS_REQUIRED",
      message: "EMAIL_FROM_ADDRESS, EMAIL_FROM or SMTP_USER is required for live email delivery.",
    });
  } else if (!isValidEmailAddress(emailConfig.from.address)) {
    errors.push({
      channel: "email",
      code: "INVALID_EMAIL_FROM_ADDRESS",
      message: "The configured email sender address must be a valid email address.",
    });
  }

  if (emailConfig.replyTo && !isValidEmailAddress(emailConfig.replyTo)) {
    errors.push({
      channel: "email",
      code: "INVALID_EMAIL_REPLY_TO",
      message: "EMAIL_REPLY_TO must be a valid email address.",
    });
  }
}

function validateSmsConfiguration(config, errors, warnings) {
  const smsConfig = config.sms;

  if (!smsConfig.enabled) {
    warnings.push({
      channel: "sms",
      code: "SMS_DELIVERY_DISABLED",
      message: "SMS delivery is disabled.",
    });
    return;
  }

  if (!Object.values(SMS_PROVIDERS).includes(smsConfig.provider)) {
    errors.push({
      channel: "sms",
      code: "UNSUPPORTED_SMS_PROVIDER",
      message: `Unsupported SMS provider: ${smsConfig.provider}.`,
    });
    return;
  }

  if (config.mode === DELIVERY_MODES.SANDBOX) {
    return;
  }

  const twilioConfig = smsConfig.twilio;

  if (!twilioConfig.accountSid) {
    errors.push({
      channel: "sms",
      code: "TWILIO_ACCOUNT_SID_REQUIRED",
      message: "TWILIO_ACCOUNT_SID is required for live SMS delivery.",
    });
  }

  if (!twilioConfig.authToken) {
    errors.push({
      channel: "sms",
      code: "TWILIO_AUTH_TOKEN_REQUIRED",
      message: "TWILIO_AUTH_TOKEN is required for live SMS delivery.",
    });
  }

  if (!twilioConfig.fromNumber && !twilioConfig.messagingServiceSid) {
    errors.push({
      channel: "sms",
      code: "TWILIO_SENDER_REQUIRED",
      message:
        "TWILIO_FROM_NUMBER, TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID is required for live SMS delivery.",
    });
  }

  if (twilioConfig.fromNumber && !isValidE164Number(twilioConfig.fromNumber)) {
    errors.push({
      channel: "sms",
      code: "INVALID_TWILIO_FROM_NUMBER",
      message: "TWILIO_FROM_NUMBER/TWILIO_SMS_FROM must use E.164 format.",
    });
  }
}

function buildChannelValidation(channel, errors, warnings) {
  const channelErrors = errors
    .filter((entry) => !entry.channel || entry.channel === channel)
    .map((entry) => entry.message);

  const channelWarnings = warnings
    .filter((entry) => !entry.channel || entry.channel === channel)
    .map((entry) => entry.message);

  return {
    valid: channelErrors.length === 0,
    errors: channelErrors,
    warnings: channelWarnings,
  };
}

function validateMessageDeliveryConfig(
  suppliedConfig = getMessageDeliveryConfig(),
  { throwOnError = true } = {}
) {
  const config = suppliedConfig || getMessageDeliveryConfig();
  const errors = [];
  const warnings = [];

  if (!Object.values(DELIVERY_MODES).includes(config.mode)) {
    errors.push({
      channel: null,
      code: "INVALID_DELIVERY_MODE",
      message: "MESSAGE_DELIVERY_MODE must be sandbox or live.",
    });
  }

  validateEmailConfiguration(config, errors, warnings);
  validateSmsConfiguration(config, errors, warnings);

  if (!config.email.enabled && !config.sms.enabled) {
    warnings.push({
      channel: null,
      code: "NO_DELIVERY_CHANNELS_ENABLED",
      message: "Both email and SMS delivery are disabled.",
    });
  }

  const result = {
    valid: errors.length === 0,
    mode: config.mode,
    errors,
    warnings,
    channels: {
      email: buildChannelValidation("email", errors, warnings),
      sms: buildChannelValidation("sms", errors, warnings),
    },
  };

  if (throwOnError && errors.length > 0) {
    throw createConfigurationError(
      errors.map((error) => error.message).join(" "),
      {
        statusCode: 500,
        code: "INVALID_MESSAGE_DELIVERY_CONFIGURATION",
        details: result,
      }
    );
  }

  return result;
}

function normaliseChannel(channel) {
  const normalisedChannel = normaliseLowercase(channel);

  if (!["email", "sms"].includes(normalisedChannel)) {
    throw createConfigurationError(
      `Unsupported message-delivery channel: ${normalisedChannel || "unknown"}.`,
      {
        statusCode: 400,
        code: "UNSUPPORTED_DELIVERY_CHANNEL",
        channel: normalisedChannel || null,
      }
    );
  }

  return normalisedChannel;
}

function assertDeliveryChannelConfigured(
  channel,
  suppliedConfig = getMessageDeliveryConfig()
) {
  const normalisedChannel = normaliseChannel(channel);
  const config = suppliedConfig || getMessageDeliveryConfig();
  const channelConfig = config[normalisedChannel];

  if (!channelConfig.enabled) {
    throw createConfigurationError(
      `${normalisedChannel.toUpperCase()} delivery is disabled.`,
      {
        statusCode: 503,
        code: `${normalisedChannel.toUpperCase()}_DELIVERY_DISABLED`,
        channel: normalisedChannel,
        provider: channelConfig.provider,
      }
    );
  }

  const validation = validateMessageDeliveryConfig(config, {
    throwOnError: false,
  });

  const channelErrors = validation.errors.filter(
    (error) => !error.channel || error.channel === normalisedChannel
  );

  if (channelErrors.length > 0) {
    throw createConfigurationError(
      channelErrors.map((error) => error.message).join(" "),
      {
        statusCode: 500,
        code: `INVALID_${normalisedChannel.toUpperCase()}_DELIVERY_CONFIGURATION`,
        channel: normalisedChannel,
        provider: channelConfig.provider,
        details: { errors: channelErrors },
      }
    );
  }

  return channelConfig;
}

function redactSecret(value) {
  const secret = normaliseText(value);

  if (!secret) {
    return "";
  }

  if (secret.length <= 4) {
    return "****";
  }

  return `${secret.slice(0, 2)}${"*".repeat(
    Math.min(secret.length - 4, 12)
  )}${secret.slice(-2)}`;
}

function getSafeMessageDeliveryConfig() {
  const config = getMessageDeliveryConfig();
  const validation = validateMessageDeliveryConfig(config, {
    throwOnError: false,
  });

  return {
    mode: config.mode,
    sandbox: config.sandbox,
    live: config.live,
    application: { ...config.application },
    consent: { ...config.consent },
    retry: { ...config.retry },

    email: {
      enabled: config.email.enabled,
      provider: config.email.provider,
      batchSize: config.email.batchSize,
      from: { ...config.email.from },
      sender: { ...config.email.sender },
      replyTo: config.email.replyTo,
      connectionTimeoutMs: config.email.connectionTimeoutMs,
      greetingTimeoutMs: config.email.greetingTimeoutMs,
      socketTimeoutMs: config.email.socketTimeoutMs,
      smtp: {
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        requireTls: config.email.smtp.requireTls,
        rejectUnauthorized: config.email.smtp.rejectUnauthorized,
        user: redactSecret(config.email.smtp.user),
        username: redactSecret(config.email.smtp.username),
        password: config.email.smtp.password ? "********" : "",
        connectionTimeoutMs: config.email.smtp.connectionTimeoutMs,
        greetingTimeoutMs: config.email.smtp.greetingTimeoutMs,
        socketTimeoutMs: config.email.smtp.socketTimeoutMs,
      },
    },

    sms: {
      enabled: config.sms.enabled,
      provider: config.sms.provider,
      batchSize: config.sms.batchSize,
      defaultCountryCode: config.sms.defaultCountryCode,
      twilio: {
        accountSid: redactSecret(config.sms.twilio.accountSid),
        authToken: config.sms.twilio.authToken ? "********" : "",
        fromNumber: config.sms.twilio.fromNumber,
        messagingServiceSid: redactSecret(config.sms.twilio.messagingServiceSid),
        statusCallbackUrl: config.sms.twilio.statusCallbackUrl,
        webhookBaseUrl: config.sms.twilio.webhookBaseUrl,
        webhookValidationEnabled: config.sms.twilio.webhookValidationEnabled,
      },
    },

    validation,
  };
}

export {
  DELIVERY_MODES,
  EMAIL_PROVIDERS,
  SMS_PROVIDERS,
  assertDeliveryChannelConfigured,
  createConfigurationError,
  getMessageDeliveryConfig,
  getSafeMessageDeliveryConfig,
  isValidE164Number,
  validateMessageDeliveryConfig,
};

export default getMessageDeliveryConfig;