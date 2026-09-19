import {
  getMessageDeliveryConfig,
  validateMessageDeliveryConfig,
} from "../../config/messageDeliveryConfig.js";
import {
  sendEmail,
  verifyEmailDeliveryConnection,
} from "../../services/emailDeliveryService.js";

const CONFIRMATION =
  "RUN_SENDGRID_MARKETING_ACCEPTANCE";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function normaliseEmail(
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
      "SENDGRID_MARKETING_ACCEPTANCE_EMAIL_INVALID";
    throw error;
  }

  return normalised;
}

function positiveInteger(
  value,
  fieldName
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(
      number
    ) ||
    number <= 0
  ) {
    const error =
      new Error(
        `${fieldName} must be a positive integer.`
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_GROUP_INVALID";
    throw error;
  }

  return number;
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

export function buildSendGridMarketingAcceptancePlan(
  environment =
    process.env
) {
  if (
    text(
      environment
        .SENDGRID_MARKETING_ACCEPTANCE_CONFIRM
    ) !==
    CONFIRMATION
  ) {
    const error =
      new Error(
        `Refusing to send a real marketing acceptance email. Set SENDGRID_MARKETING_ACCEPTANCE_CONFIRM=${CONFIRMATION} only for a deliberate one-off acceptance run.`
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_CONFIRMATION_REQUIRED";
    throw error;
  }

  const to =
    normaliseEmail(
      environment
        .SENDGRID_MARKETING_ACCEPTANCE_TO,
      "SENDGRID_MARKETING_ACCEPTANCE_TO"
    );

  const groupId =
    positiveInteger(
      environment
        .SENDGRID_MARKETING_ACCEPTANCE_GROUP_ID,
      "SENDGRID_MARKETING_ACCEPTANCE_GROUP_ID"
    );

  const subject =
    text(
      environment
        .SENDGRID_MARKETING_ACCEPTANCE_SUBJECT
    ) ||
    "SalonAI SendGrid marketing acceptance test";

  const message =
    text(
      environment
        .SENDGRID_MARKETING_ACCEPTANCE_MESSAGE
    ) ||
    "SalonAI SendGrid marketing acceptance test. This message validates the controlled suppression-group delivery path.";

  return {
    to,
    groupId,
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

export function assertSendGridMarketingAcceptanceConfiguration(
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
        "SendGrid marketing acceptance requires MESSAGE_DELIVERY_MODE=live."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_LIVE_MODE_REQUIRED";
    throw error;
  }

  if (
    !config.email
      ?.enabled
  ) {
    const error =
      new Error(
        "SendGrid marketing acceptance requires EMAIL_DELIVERY_ENABLED=true."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_EMAIL_DISABLED";
    throw error;
  }

  if (
    config.email
      ?.provider !==
    "sendgrid"
  ) {
    const error =
      new Error(
        "SendGrid marketing acceptance requires EMAIL_PROVIDER=sendgrid."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_PROVIDER_REQUIRED";
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
      "SENDGRID_MARKETING_ACCEPTANCE_CONFIGURATION_INVALID";
    throw error;
  }

  if (
    config.email.sendgrid
      ?.eventWebhook
      ?.enabled !==
      true ||
    !text(
      config.email.sendgrid
        ?.eventWebhook
        ?.publicKey
    )
  ) {
    const error =
      new Error(
        "SendGrid marketing acceptance requires the signed Event Webhook to be enabled and configured first."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_WEBHOOK_REQUIRED";
    throw error;
  }

  if (
    config.email.sendgrid
      ?.marketing
      ?.senderVerified !==
    true
  ) {
    const error =
      new Error(
        "SendGrid marketing acceptance requires SENDGRID_SENDER_VERIFIED=true."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_SENDER_NOT_VERIFIED";
    throw error;
  }

  if (
    config.email.sendgrid
      ?.marketing
      ?.domainAuthenticated !==
    true
  ) {
    const error =
      new Error(
        "SendGrid marketing acceptance requires SENDGRID_DOMAIN_AUTHENTICATED=true."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_DOMAIN_NOT_AUTHENTICATED";
    throw error;
  }

  if (
    config.email.sendgrid
      ?.marketing
      ?.enabled ===
    true
  ) {
    const error =
      new Error(
        "Refusing marketing acceptance while SENDGRID_MARKETING_ENABLED=true. Run acceptance before enabling live marketing."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_ALREADY_ENABLED";
    throw error;
  }

  return config;
}

export async function runSendGridMarketingAcceptance({
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
    buildSendGridMarketingAcceptancePlan(
      environment
    );

  assertSendGridMarketingAcceptanceConfiguration(
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
      "SENDGRID_MARKETING_ACCEPTANCE_VERIFICATION_FAILED";
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
          "marketing_provider_acceptance",
        provider:
          "sendgrid",
        sendGridSuppressionGroupId:
          plan.groupId,
      },
    });

  if (
    delivery
      ?.success !==
    true
  ) {
    const error =
      new Error(
        "SendGrid marketing acceptance email was not accepted by the delivery provider."
      );
    error.code =
      "SENDGRID_MARKETING_ACCEPTANCE_DELIVERY_FAILED";
    throw error;
  }

  return {
    success:
      true,
    provider:
      "sendgrid",
    purpose:
      "marketing_provider_acceptance",
    recipient:
      maskEmail(
        plan.to
      ),
    suppressionGroupId:
      plan.groupId,
    smtpVerified:
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
    activationChanged:
      false,
    acceptanceConfirmed:
      false,
    nextAction:
      "Verify receipt and signed SendGrid Event Webhook evidence for this provider message before setting SENDGRID_MARKETING_ACCEPTANCE_CONFIRMED=true. Keep SENDGRID_MARKETING_ENABLED=false until that evidence is confirmed.",
  };
}

export {
  CONFIRMATION as SENDGRID_MARKETING_ACCEPTANCE_CONFIRMATION,
};

export default {
  assertSendGridMarketingAcceptanceConfiguration,
  buildSendGridMarketingAcceptancePlan,
  runSendGridMarketingAcceptance,
};
