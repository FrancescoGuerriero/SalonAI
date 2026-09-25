import {
  getMessageDeliveryConfig,
  validateMessageDeliveryConfig,
} from "../../config/messageDeliveryConfig.js";

function text(value) {
  return String(value ?? "").trim();
}

export function buildSendGridReadinessReport(
  suppliedConfig = getMessageDeliveryConfig()
) {
  const config =
    suppliedConfig ||
    getMessageDeliveryConfig();

  const email =
    config.email || {};
  const sendgrid =
    email.sendgrid || {};
  const marketing =
    sendgrid.marketing || {};
  const eventWebhook =
    sendgrid.eventWebhook || {};

  const validation =
    validateMessageDeliveryConfig(
      config,
      {
        throwOnError: false,
      }
    );

  const checks = {
    liveMode:
      config.mode === "live",
    emailEnabled:
      email.enabled === true,
    sendGridProvider:
      email.provider ===
      "sendgrid",
    apiKeyConfigured:
      Boolean(
        text(
          sendgrid.apiKey
        )
      ),
    senderAddressConfigured:
      Boolean(
        text(
          email.sender
            ?.address ||
          email.from
            ?.address
        )
      ),
    smtpRelayConfigured:
      Boolean(
        text(
          email.smtp?.host
        )
      ),
    emailConfigurationValid:
      validation.channels
        ?.email?.valid ===
      true,
    signedEventWebhook:
      eventWebhook.enabled ===
        true &&
      Boolean(
        text(
          eventWebhook.publicKey
        )
      ),
    senderVerified:
      marketing.senderVerified ===
      true,
    domainAuthenticated:
      marketing.domainAuthenticated ===
      true,
  };

  const applicationChecks = [
    "liveMode",
    "emailEnabled",
    "sendGridProvider",
    "apiKeyConfigured",
    "senderAddressConfigured",
    "smtpRelayConfigured",
    "emailConfigurationValid",
    "signedEventWebhook",
  ];

  const providerChecks = [
    "senderVerified",
    "domainAuthenticated",
  ];

  const applicationBlockers =
    applicationChecks.filter(
      (key) =>
        checks[key] !== true
    );

  const providerBlockers =
    providerChecks.filter(
      (key) =>
        checks[key] !== true
    );

  const blockers = [
    ...applicationBlockers,
    ...providerBlockers,
  ];

  const nextSteps = [];

  if (
    !checks.senderVerified ||
    !checks.domainAuthenticated
  ) {
    nextSteps.push(
      "Complete SendGrid Sender Authentication/domain authentication and then set SENDGRID_SENDER_VERIFIED=true and SENDGRID_DOMAIN_AUTHENTICATED=true."
    );
  }

  if (
    !checks.apiKeyConfigured
  ) {
    nextSteps.push(
      "Create a SendGrid API key with Mail Send permission and set SENDGRID_API_KEY."
    );
  }

  if (
    !checks.signedEventWebhook
  ) {
    nextSteps.push(
      "Enable the SendGrid signed Event Webhook for /api/message-delivery/webhooks/sendgrid/events and set SENDGRID_EVENT_WEBHOOK_ENABLED=true plus SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY."
    );
  }

  if (
    checks.apiKeyConfigured &&
    checks.signedEventWebhook &&
    checks.senderVerified &&
    checks.domainAuthenticated &&
    (
      !checks.liveMode ||
      !checks.emailEnabled
    )
  ) {
    nextSteps.push(
      "Set MESSAGE_DELIVERY_MODE=live and EMAIL_DELIVERY_ENABLED=true for the controlled acceptance run."
    );
  }

  if (
    blockers.length === 0
  ) {
    nextSteps.push(
      "Run npm run sendgrid:acceptance with SENDGRID_ACCEPTANCE_CONFIRM=RUN_SENDGRID_EMAIL_ACCEPTANCE and a dedicated SENDGRID_ACCEPTANCE_TO address."
    );
  }

  return {
    provider:
      "sendgrid",
    readyForAcceptance:
      blockers.length === 0,
    checks,
    blockers,
    applicationBlockers,
    providerBlockers,
    email: {
      provider:
        email.provider || "",
      fromAddress:
        text(
          email.sender
            ?.address ||
          email.from
            ?.address
        ),
      smtpHost:
        text(
          email.smtp?.host
        ),
      smtpPort:
        email.smtp?.port ||
        null,
      apiKeyConfigured:
        checks.apiKeyConfigured,
      eventWebhookEnabled:
        eventWebhook.enabled ===
        true,
      eventWebhookKeyConfigured:
        Boolean(
          text(
            eventWebhook.publicKey
          )
        ),
    },
    nextSteps,
  };
}

function safeProviderProbeFailure(
  error
) {
  const responseCode =
    Number(
      error
        ?.providerResponse
        ?.responseCode ??
      error
        ?.responseCode
    );

  return {
    errorCode:
      text(
        error?.code
      ) ||
      "SENDGRID_PROVIDER_CONNECTION_FAILED",
    responseCode:
      Number.isFinite(
        responseCode
      )
        ? responseCode
        : null,
  };
}

export async function buildSendGridOperationalReadinessReport({
  suppliedConfig =
    getMessageDeliveryConfig(),
  verifyConnection,
} = {}) {
  const report =
    buildSendGridReadinessReport(
      suppliedConfig
    );

  if (
    report.readyForAcceptance !==
    true
  ) {
    return {
      ...report,
      providerProbe: {
        attempted: false,
        success: false,
        reason:
          "configuration-readiness-blocked",
      },
    };
  }

  if (
    typeof verifyConnection !==
    "function"
  ) {
    throw new TypeError(
      "verifyConnection must be provided for SendGrid operational readiness."
    );
  }

  try {
    const verification =
      await verifyConnection();

    if (
      verification?.success !==
      true
    ) {
      const blockers = [
        ...report.blockers,
        "providerConnection",
      ];

      return {
        ...report,
        readyForAcceptance:
          false,
        checks: {
          ...report.checks,
          providerConnection:
            false,
        },
        blockers,
        providerBlockers: [
          ...report.providerBlockers,
          "providerConnection",
        ],
        providerProbe: {
          attempted: true,
          success: false,
          errorCode:
            "SENDGRID_PROVIDER_CONNECTION_NOT_VERIFIED",
          responseCode:
            null,
        },
        nextSteps: [
          ...report.nextSteps.filter(
            (step) =>
              !step.startsWith(
                "Run npm run sendgrid:acceptance"
              )
          ),
          "Resolve the SendGrid account, plan, credit or SMTP-authentication blocker and rerun production readiness before any acceptance send.",
        ],
      };
    }

    return {
      ...report,
      checks: {
        ...report.checks,
        providerConnection:
          true,
      },
      providerProbe: {
        attempted: true,
        success: true,
        provider:
          text(
            verification.provider
          ) ||
          "sendgrid",
        host:
          text(
            verification.host
          ),
        port:
          verification.port ||
          null,
        verifiedAt:
          verification.verifiedAt ||
          null,
      },
    };
  } catch (error) {
    const failure =
      safeProviderProbeFailure(
        error
      );

    return {
      ...report,
      readyForAcceptance:
        false,
      checks: {
        ...report.checks,
        providerConnection:
          false,
      },
      blockers: [
        ...report.blockers,
        "providerConnection",
      ],
      providerBlockers: [
        ...report.providerBlockers,
        "providerConnection",
      ],
      providerProbe: {
        attempted: true,
        success: false,
        ...failure,
      },
      nextSteps: [
        ...report.nextSteps.filter(
          (step) =>
            !step.startsWith(
              "Run npm run sendgrid:acceptance"
            )
        ),
        "Resolve the SendGrid account, plan, credit or SMTP-authentication blocker and rerun production readiness before any acceptance send.",
      ],
    };
  }
}

export default {
  buildSendGridReadinessReport,
  buildSendGridOperationalReadinessReport,
};
