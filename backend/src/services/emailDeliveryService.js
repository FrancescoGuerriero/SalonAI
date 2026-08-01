import {
  getMessageDeliveryConfig,
  validateMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

const EMAIL_ADDRESS_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_SANDBOX_MESSAGE_ID_PREFIX =
  "salonai-sandbox-email";

let transporterInstance = null;
let transporterSignature = "";
let nodemailerModule = null;

function createEmailDeliveryError(
  message,
  {
    statusCode = 500,
    code = "EMAIL_DELIVERY_ERROR",
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

function normaliseEmailAddress(value) {
  return normaliseText(value).toLowerCase();
}

function normaliseAddressList(value) {
  const values = Array.isArray(value)
    ? value
    : normaliseText(value)
      ? [value]
      : [];

  return Array.from(
    new Set(
      values
        .flatMap((entry) =>
          String(entry || "")
            .split(",")
            .map((item) =>
              normaliseEmailAddress(item)
            )
        )
        .filter(Boolean)
    )
  );
}

function validateEmailAddress(
  email,
  fieldName = "Email address"
) {
  const normalisedEmail =
    normaliseEmailAddress(email);

  if (!normalisedEmail) {
    throw createEmailDeliveryError(
      `${fieldName} is required.`,
      {
        statusCode: 400,
        code: "EMAIL_ADDRESS_REQUIRED",
      }
    );
  }

  if (
    !EMAIL_ADDRESS_PATTERN.test(
      normalisedEmail
    )
  ) {
    throw createEmailDeliveryError(
      `${fieldName} is invalid.`,
      {
        statusCode: 400,
        code: "INVALID_EMAIL_ADDRESS",
      }
    );
  }

  return normalisedEmail;
}

function validateEmailAddressList(
  addresses,
  fieldName,
  {
    required = false,
  } = {}
) {
  const normalisedAddresses =
    normaliseAddressList(addresses);

  if (
    required &&
    normalisedAddresses.length === 0
  ) {
    throw createEmailDeliveryError(
      `${fieldName} requires at least one email address.`,
      {
        statusCode: 400,
        code: "EMAIL_RECIPIENT_REQUIRED",
      }
    );
  }

  for (const address of normalisedAddresses) {
    validateEmailAddress(
      address,
      fieldName
    );
  }

  return normalisedAddresses;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value) {
  const text = normaliseText(value);

  if (!text) {
    return "";
  }

  return escapeHtml(text)
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) =>
      line || "&nbsp;"
    )
    .join("<br />");
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(
      /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,
      " "
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createMessageId(prefix) {
  const randomValue =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `${prefix}-${Date.now()}-${randomValue}`;
}

function createTransporterSignature(
  emailConfig
) {
  return JSON.stringify({
    host: emailConfig.smtp.host,
    port: emailConfig.smtp.port,
    secure: emailConfig.smtp.secure,
    requireTls:
      emailConfig.smtp.requireTls,
    rejectUnauthorized:
      emailConfig.smtp
        .rejectUnauthorized,
    username:
      emailConfig.smtp.username,
    password:
      emailConfig.smtp.password,
    connectionTimeoutMs:
      emailConfig.connectionTimeoutMs,
    greetingTimeoutMs:
      emailConfig.greetingTimeoutMs,
    socketTimeoutMs:
      emailConfig.socketTimeoutMs,
  });
}

async function loadNodemailer() {
  if (nodemailerModule) {
    return nodemailerModule;
  }

  try {
    const importedModule =
      await import("nodemailer");

    nodemailerModule =
      importedModule.default ||
      importedModule;

    return nodemailerModule;
  } catch (error) {
    throw createEmailDeliveryError(
      "Nodemailer is not installed. Install it in the backend before enabling SMTP email delivery.",
      {
        statusCode: 500,
        code:
          "NODEMAILER_NOT_INSTALLED",
        cause: error,
      }
    );
  }
}

function assertEmailConfiguration(
  config
) {
  const validation =
    validateMessageDeliveryConfig(
      config
    );

  const emailErrors =
    validation.channels?.email
      ?.errors || [];

  if (emailErrors.length > 0) {
    throw createEmailDeliveryError(
      emailErrors.join(" "),
      {
        statusCode: 500,
        code:
          "INVALID_EMAIL_DELIVERY_CONFIGURATION",
      }
    );
  }

  if (!config.email.enabled) {
    throw createEmailDeliveryError(
      "Email delivery is disabled.",
      {
        statusCode: 503,
        code:
          "EMAIL_DELIVERY_DISABLED",
      }
    );
  }

  return config.email;
}

async function createSmtpTransporter(
  emailConfig
) {
  const nodemailer =
    await loadNodemailer();

  const authentication =
    emailConfig.smtp.username &&
    emailConfig.smtp.password
      ? {
          user:
            emailConfig.smtp.username,
          pass:
            emailConfig.smtp.password,
        }
      : undefined;

  return nodemailer.createTransport({
    host: emailConfig.smtp.host,
    port: emailConfig.smtp.port,
    secure:
      emailConfig.smtp.secure,
    requireTLS:
      emailConfig.smtp.requireTls,

    auth: authentication,

    tls: {
      rejectUnauthorized:
        emailConfig.smtp
          .rejectUnauthorized,
    },

    connectionTimeout:
      emailConfig.connectionTimeoutMs,

    greetingTimeout:
      emailConfig.greetingTimeoutMs,

    socketTimeout:
      emailConfig.socketTimeoutMs,

    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

async function getSmtpTransporter(
  emailConfig
) {
  const currentSignature =
    createTransporterSignature(
      emailConfig
    );

  if (
    transporterInstance &&
    transporterSignature ===
      currentSignature
  ) {
    return transporterInstance;
  }

  if (
    transporterInstance &&
    typeof transporterInstance.close ===
      "function"
  ) {
    transporterInstance.close();
  }

  transporterInstance =
    await createSmtpTransporter(
      emailConfig
    );

  transporterSignature =
    currentSignature;

  return transporterInstance;
}

function normaliseEmailMessage({
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  replyTo,
  headers,
  attachments,
  metadata,
} = {}) {
  const recipients =
    validateEmailAddressList(
      to,
      "To",
      {
        required: true,
      }
    );

  const carbonCopyRecipients =
    validateEmailAddressList(
      cc,
      "CC"
    );

  const blindCopyRecipients =
    validateEmailAddressList(
      bcc,
      "BCC"
    );

  const normalisedSubject =
    normaliseText(subject);

  if (!normalisedSubject) {
    throw createEmailDeliveryError(
      "Email subject is required.",
      {
        statusCode: 400,
        code:
          "EMAIL_SUBJECT_REQUIRED",
      }
    );
  }

  if (
    normalisedSubject.length > 998
  ) {
    throw createEmailDeliveryError(
      "Email subject is too long.",
      {
        statusCode: 400,
        code:
          "EMAIL_SUBJECT_TOO_LONG",
      }
    );
  }

  const normalisedText =
    normaliseText(text);

  const normalisedHtml =
    normaliseText(html);

  if (
    !normalisedText &&
    !normalisedHtml
  ) {
    throw createEmailDeliveryError(
      "Email text or HTML content is required.",
      {
        statusCode: 400,
        code:
          "EMAIL_CONTENT_REQUIRED",
      }
    );
  }

  const finalText =
    normalisedText ||
    stripHtml(normalisedHtml);

  const finalHtml =
    normalisedHtml ||
    textToHtml(normalisedText);

  const normalisedReplyTo =
    normaliseText(replyTo)
      ? validateEmailAddress(
          replyTo,
          "Reply-to address"
        )
      : "";

  return {
    to: recipients,
    cc: carbonCopyRecipients,
    bcc: blindCopyRecipients,
    subject: normalisedSubject,
    text: finalText,
    html: finalHtml,
    replyTo: normalisedReplyTo,

    headers:
      headers &&
      typeof headers === "object"
        ? headers
        : {},

    attachments:
      Array.isArray(attachments)
        ? attachments
        : [],

    metadata:
      metadata &&
      typeof metadata === "object"
        ? metadata
        : {},
  };
}

function buildSender(
  senderConfig
) {
  const senderAddress =
    validateEmailAddress(
      senderConfig.address,
      "Sender email address"
    );

  const senderName =
    normaliseText(
      senderConfig.name
    );

  return senderName
    ? {
        name: senderName,
        address: senderAddress,
      }
    : senderAddress;
}

function buildProviderMessage({
  message,
  emailConfig,
}) {
  return {
    from: buildSender(
      emailConfig.sender
    ),

    to: message.to,

    cc:
      message.cc.length > 0
        ? message.cc
        : undefined,

    bcc:
      message.bcc.length > 0
        ? message.bcc
        : undefined,

    replyTo:
      message.replyTo ||
      emailConfig.sender.replyTo ||
      undefined,

    subject: message.subject,
    text: message.text,
    html: message.html,

    headers: {
      "X-SalonAI-Application":
        "SalonAI",
      ...message.headers,
    },

    attachments:
      message.attachments.length > 0
        ? message.attachments
        : undefined,
  };
}

function createSandboxResponse({
  message,
  emailConfig,
}) {
  const messageId =
    createMessageId(
      DEFAULT_SANDBOX_MESSAGE_ID_PREFIX
    );

  return {
    success: true,
    mode: "sandbox",
    channel: "email",
    provider:
      emailConfig.provider,
    messageId,
    providerMessageId:
      messageId,

    accepted: [
      ...message.to,
      ...message.cc,
      ...message.bcc,
    ],

    rejected: [],

    response:
      "Email accepted by SalonAI sandbox. No external email was sent.",

    envelope: {
      from:
        emailConfig.sender.address,
      to: [
        ...message.to,
        ...message.cc,
        ...message.bcc,
      ],
    },

    metadata: message.metadata,
    sentAt:
      new Date().toISOString(),
  };
}

function classifyProviderError(error) {
  const responseCode = Number(
    error?.responseCode
  );

  const errorCode =
    normaliseText(
      error?.code
    ).toUpperCase();

  const retryable =
    responseCode >= 400 &&
    responseCode < 500
      ? true
      : [
          "ETIMEDOUT",
          "ECONNECTION",
          "ECONNRESET",
          "EHOSTUNREACH",
          "ENETUNREACH",
          "ESOCKET",
        ].includes(errorCode);

  return {
    retryable,

    code:
      errorCode ||
      "SMTP_DELIVERY_FAILED",

    responseCode:
      Number.isFinite(responseCode)
        ? responseCode
        : null,

    command:
      normaliseText(
        error?.command
      ) || null,

    response:
      normaliseText(
        error?.response
      ) || null,
  };
}

async function sendEmail(
  emailMessage
) {
  const config =
    getMessageDeliveryConfig();

  const emailConfig =
    assertEmailConfiguration(
      config
    );

  const message =
    normaliseEmailMessage(
      emailMessage
    );

  if (config.mode === "sandbox") {
    return createSandboxResponse({
      message,
      emailConfig,
    });
  }

  const transporter =
    await getSmtpTransporter(
      emailConfig
    );

  const providerMessage =
    buildProviderMessage({
      message,
      emailConfig,
    });

  try {
    const result =
      await transporter.sendMail(
        providerMessage
      );

    const accepted =
      Array.isArray(result.accepted)
        ? result.accepted.map(String)
        : [];

    const rejected =
      Array.isArray(result.rejected)
        ? result.rejected.map(String)
        : [];

    return {
      success:
        accepted.length > 0 &&
        rejected.length === 0,

      mode: config.mode,
      channel: "email",
      provider:
        emailConfig.provider,

      messageId:
        result.messageId ||
        createMessageId(
          "salonai-email"
        ),

      providerMessageId:
        result.messageId || null,

      accepted,
      rejected,

      pending:
        Array.isArray(result.pending)
          ? result.pending.map(String)
          : [],

      response:
        normaliseText(
          result.response
        ),

      envelope:
        result.envelope || {
          from:
            emailConfig.sender.address,
          to: [
            ...message.to,
            ...message.cc,
            ...message.bcc,
          ],
        },

      metadata: message.metadata,

      sentAt:
        new Date().toISOString(),
    };
  } catch (error) {
    const classification =
      classifyProviderError(error);

    throw createEmailDeliveryError(
      error?.message ||
        "SMTP email delivery failed.",
      {
        statusCode: 502,
        code: classification.code,
        cause: error,
        retryable:
          classification.retryable,

        providerResponse: {
          responseCode:
            classification.responseCode,

          command:
            classification.command,

          response:
            classification.response,
        },
      }
    );
  }
}

async function verifyEmailDeliveryConnection() {
  const config =
    getMessageDeliveryConfig();

  const emailConfig =
    assertEmailConfiguration(
      config
    );

  if (config.mode === "sandbox") {
    return {
      success: true,
      mode: "sandbox",
      channel: "email",
      provider:
        emailConfig.provider,

      message:
        "Email sandbox configuration is valid. SMTP was not contacted.",

      verifiedAt:
        new Date().toISOString(),
    };
  }

  const transporter =
    await getSmtpTransporter(
      emailConfig
    );

  try {
    await transporter.verify();

    return {
      success: true,
      mode: config.mode,
      channel: "email",
      provider:
        emailConfig.provider,

      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure:
        emailConfig.smtp.secure,

      message:
        "SMTP connection verified successfully.",

      verifiedAt:
        new Date().toISOString(),
    };
  } catch (error) {
    const classification =
      classifyProviderError(error);

    throw createEmailDeliveryError(
      error?.message ||
        "SMTP connection verification failed.",
      {
        statusCode: 502,
        code:
          "SMTP_VERIFICATION_FAILED",
        cause: error,
        retryable:
          classification.retryable,

        providerResponse: {
          responseCode:
            classification.responseCode,

          command:
            classification.command,

          response:
            classification.response,
        },
      }
    );
  }
}

function closeEmailDeliveryConnection() {
  if (
    transporterInstance &&
    typeof transporterInstance.close ===
      "function"
  ) {
    transporterInstance.close();
  }

  transporterInstance = null;
  transporterSignature = "";
}

export {
  closeEmailDeliveryConnection,
  createEmailDeliveryError,
  normaliseEmailAddress,
  normaliseEmailMessage,
  sendEmail,
  verifyEmailDeliveryConnection,
};

export default sendEmail;