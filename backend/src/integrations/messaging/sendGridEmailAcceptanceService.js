import {
  getMessageDeliveryConfig,
  validateMessageDeliveryConfig,
} from "../../config/messageDeliveryConfig.js";
import {
  sendEmail,
  verifyEmailDeliveryConnection,
} from "../../services/emailDeliveryService.js";

const CONFIRMATION =
  "RUN_SENDGRID_EMAIL_ACCEPTANCE";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function email(
  value,
  fieldName
) {
  const normalised =
    text(
      value
    ).toLowerCase();

  if (
    !EMAIL_PATTERN.test(
      normalised
    )
  ) {
    const error =
      new Error(
        `${fieldName} must be a valid email address.`
      );
    error.code =
      "SENDGRID_ACCEPTANCE_EMAIL_INVALID";
    throw error;
  }

  return normalised;
}

function maskEmail(
  value
) {
  const [
    local,
    domain,
  ] =
    String(
      value || ""
    ).split(
      "@"
    );

  if (
    !local ||
    !domain
  ) {
    return "";
  }

  const visible =
    local.slice(
      0,
      Math.min(
        2,
        local.length
      )
    );

  return (
    visible +
    "*".repeat(
      Math.max(
        1,
        Math.min(
          8,
          local.length -
            visible.length
        )
      )
    ) +
    "@" +
    domain
  );
}

export function buildSendGridEmailAcceptancePlan(
  environment =
    process.env
) {
  if (
    text(
      environment
        .SENDGRID_ACCEPTANCE_CONFIRM
    ) !==
    CONFIRMATION
  ) {
    const error =
      new Error(
        `Refusing to send a real email. Set SENDGRID_ACCEPTANCE_CONFIRM=${CONFIRMATION} only for a deliberate acceptance run.`
      );
    error.code =
      "SENDGRID_ACCEPTANCE_CONFIRMATION_REQUIRED";
    throw error;
  }

  const apiKey =
    text(
      environment
        .SENDGRID_API_KEY
    );

  if (
    !apiKey
  ) {
    const error =
      new Error(
        "SENDGRID_API_KEY is required."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_API_KEY_REQUIRED";
    throw error;
  }

  if (
    !apiKey.startsWith(
      "SG."
    )
  ) {
    const error =
      new Error(
        "SENDGRID_API_KEY must be a SendGrid API key beginning with SG."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_API_KEY_INVALID";
    throw error;
  }

  const to =
    email(
      environment
        .SENDGRID_ACCEPTANCE_TO,
      "SENDGRID_ACCEPTANCE_TO"
    );

  const subject =
    text(
      environment
        .SENDGRID_ACCEPTANCE_SUBJECT
    ) ||
    "SalonAI SendGrid acceptance test";

  const message =
    text(
      environment
        .SENDGRID_ACCEPTANCE_MESSAGE
    ) ||
    "SalonAI Twilio SendGrid acceptance test. No reply is required.";

  return {
    to,
    subject:
      subject.slice(
        0,
        200
      ),
    message:
      message.slice(
        0,
        4000
      ),
  };
}

export function assertSendGridAcceptanceConfiguration(
  suppliedConfig =
    getMessageDeliveryConfig()
) {
  const config =
    suppliedConfig ||
    getMessageDeliveryConfig();

  const validation =
    validateMessageDeliveryConfig(
      config,
      {
        throwOnError:
          false,
      }
    );

  if (
    config.mode !==
    "live"
  ) {
    const error =
      new Error(
        "SendGrid acceptance requires MESSAGE_DELIVERY_MODE=live."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_LIVE_MODE_REQUIRED";
    throw error;
  }

  if (
    !config.email
      ?.enabled
  ) {
    const error =
      new Error(
        "SendGrid acceptance requires EMAIL_DELIVERY_ENABLED=true."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_EMAIL_DISABLED";
    throw error;
  }

  if (
    config.email
      ?.provider !==
    "sendgrid"
  ) {
    const error =
      new Error(
        "SendGrid acceptance requires EMAIL_PROVIDER=sendgrid."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_PROVIDER_REQUIRED";
    throw error;
  }

  if (
    !validation.channels
      ?.email?.valid
  ) {
    const error =
      new Error(
        validation.channels
          ?.email?.errors
          ?.join(
            " "
          ) ||
        "SendGrid email configuration is invalid."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_CONFIGURATION_INVALID";
    throw error;
  }

  return config;
}

export async function runSendGridEmailAcceptance({
  environment =
    process.env,
  config =
    getMessageDeliveryConfig(),
  verifyConnection =
    verifyEmailDeliveryConnection,
  send =
    sendEmail,
} = {}) {
  const plan =
    buildSendGridEmailAcceptancePlan(
      environment
    );

  assertSendGridAcceptanceConfiguration(
    config
  );

  const verification =
    await verifyConnection();

  if (
    verification
      ?.success !==
    true
  ) {
    const error =
      new Error(
        "SendGrid SMTP connection verification did not succeed."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_VERIFICATION_FAILED";
    throw error;
  }

  const delivery =
    await send({
      to:
        plan.to,
      subject:
        plan.subject,
      text:
        plan.message,
      metadata: {
        purpose:
          "provider_acceptance",
        provider:
          "sendgrid",
      },
    });

  if (
    delivery
      ?.success !==
    true
  ) {
    const error =
      new Error(
        "SendGrid acceptance email was not accepted by the delivery provider."
      );
    error.code =
      "SENDGRID_ACCEPTANCE_DELIVERY_FAILED";
    throw error;
  }

  return {
    success:
      true,
    provider:
      "sendgrid",
    recipient:
      maskEmail(
        plan.to
      ),
    verified:
      true,
    accepted:
      Array.isArray(
        delivery.accepted
      )
        ? delivery.accepted
            .map(
              maskEmail
            )
        : [],
    rejectedCount:
      Array.isArray(
        delivery.rejected
      )
        ? delivery.rejected
            .length
        : 0,
    providerMessageId:
      text(
        delivery
          .providerMessageId ||
        delivery
          .messageId
      ),
    sentAt:
      delivery.sentAt ||
      new Date()
        .toISOString(),
  };
}

export {
  CONFIRMATION as SENDGRID_ACCEPTANCE_CONFIRMATION,
};

export default {
  assertSendGridAcceptanceConfiguration,
  buildSendGridEmailAcceptancePlan,
  runSendGridEmailAcceptance,
};
