function text(value) {
  return String(value ?? "").trim();
}

function boolean(value, fallback = false) {
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
    text(value).toLowerCase()
  );
}

function providerName(environment) {
  const configured =
    text(
      environment.WHATSAPP_PROVIDER
    ).toLowerCase();

  if (configured) {
    return configured;
  }

  const legacy =
    text(
      environment.WHATSAPP_PROVIDER_MODE
    ).toLowerCase();

  if (
    legacy === "twilio" ||
    legacy === "live"
  ) {
    return "twilio";
  }

  return legacy || "console";
}

function normaliseWhatsAppNumber(value) {
  const supplied =
    text(value).replace(
      /^whatsapp:/i,
      ""
    );

  return supplied;
}

function resolveWebhookUrl(environment) {
  const exact =
    text(
      environment.WHATSAPP_WEBHOOK_URL
    );

  if (exact) {
    return exact;
  }

  const base =
    text(
      environment.TWILIO_WEBHOOK_BASE_URL
    ).replace(/\/+$/, "");

  if (!base) {
    return "";
  }

  return `${base}/api/whatsapp/webhook`;
}

function validHttpsWebhookUrl(value) {
  try {
    const parsed =
      new URL(value);

    return (
      parsed.protocol === "https:" &&
      parsed.pathname ===
        "/api/whatsapp/webhook" &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

export function buildTwilioWhatsAppReadinessReport({
  environment = process.env,
  featureControlsReadable = false,
  whatsappBookingFeatureEnabled = false,
  consultationFeatureEnabled = false,
} = {}) {
  const provider =
    providerName(environment);

  const accountSid =
    text(
      environment.TWILIO_ACCOUNT_SID
    );

  const authToken =
    text(
      environment.TWILIO_AUTH_TOKEN
    );

  const whatsappFrom =
    normaliseWhatsAppNumber(
      environment.TWILIO_WHATSAPP_FROM
    );

  const webhookUrl =
    resolveWebhookUrl(
      environment
    );

  const checks = {
    liveMode:
      text(
        environment.MESSAGE_DELIVERY_MODE
      ).toLowerCase() ===
      "live",

    whatsappProvider:
      provider === "twilio",

    whatsappDeliveryEnabled:
      boolean(
        environment.WHATSAPP_DELIVERY_ENABLED,
        false
      ),

    accountSidConfigured:
      /^AC[a-f0-9]{32}$/i.test(
        accountSid
      ),

    authTokenConfigured:
      authToken.length >= 20,

    whatsappSenderConfigured:
      /^\+[1-9]\d{7,14}$/.test(
        whatsappFrom
      ),

    webhookUrlConfigured:
      validHttpsWebhookUrl(
        webhookUrl
      ),

    signedWebhookValidation:
      provider === "twilio" &&
      authToken.length >= 20,

    featureControlsReadable:
      featureControlsReadable ===
      true,

    whatsappBookingFeatureEnabled:
      whatsappBookingFeatureEnabled ===
      true,

    consultationFeatureEnabled:
      consultationFeatureEnabled ===
      true,
  };

  const applicationChecks = [
    "liveMode",
    "whatsappProvider",
    "whatsappDeliveryEnabled",
    "accountSidConfigured",
    "authTokenConfigured",
    "whatsappSenderConfigured",
    "webhookUrlConfigured",
    "signedWebhookValidation",
    "featureControlsReadable",
    "whatsappBookingFeatureEnabled",
    "consultationFeatureEnabled",
  ];

  const applicationBlockers =
    applicationChecks.filter(
      (key) =>
        checks[key] !== true
    );

  const nextSteps = [];

  if (
    !checks.whatsappProvider ||
    !checks.whatsappDeliveryEnabled
  ) {
    nextSteps.push(
      "Set WHATSAPP_PROVIDER=twilio and WHATSAPP_DELIVERY_ENABLED=true for the production WhatsApp channel."
    );
  }

  if (
    !checks.accountSidConfigured ||
    !checks.authTokenConfigured ||
    !checks.whatsappSenderConfigured
  ) {
    nextSteps.push(
      "Configure the production Twilio Account SID, Auth Token and WhatsApp sender without exposing credentials in logs."
    );
  }

  if (
    !checks.webhookUrlConfigured
  ) {
    nextSteps.push(
      "Configure WHATSAPP_WEBHOOK_URL=https://salonai.francescopicardi.co.uk/api/whatsapp/webhook or an equivalent HTTPS TWILIO_WEBHOOK_BASE_URL."
    );
  }

  if (
    !checks.featureControlsReadable ||
    !checks.whatsappBookingFeatureEnabled ||
    !checks.consultationFeatureEnabled
  ) {
    nextSteps.push(
      "Verify the production feature controls and enable whatsapp-booking plus consultation before provider acceptance."
    );
  }

  return {
    provider: "twilio",
    channel: "whatsapp",
    readyForAcceptance:
      applicationBlockers.length ===
      0,
    checks,
    blockers:
      applicationBlockers,
    applicationBlockers,
    providerBlockers: [],
    runtime: {
      provider,
      webhookUrl,
      senderConfigured:
        checks.whatsappSenderConfigured,
      credentialsConfigured:
        checks.accountSidConfigured &&
        checks.authTokenConfigured,
    },
    nextSteps,
  };
}

function safeProviderProbeFailure(
  error
) {
  const status =
    Number(
      error?.status ||
      error?.statusCode
    );

  return {
    errorCode:
      text(
        error?.code
      ) ||
      "TWILIO_ACCOUNT_PROBE_FAILED",
    httpStatus:
      Number.isFinite(status)
        ? status
        : null,
  };
}

export async function buildTwilioWhatsAppOperationalReadinessReport({
  environment = process.env,
  featureControlsReadable = false,
  whatsappBookingFeatureEnabled = false,
  consultationFeatureEnabled = false,
  probeAccount,
} = {}) {
  const report =
    buildTwilioWhatsAppReadinessReport({
      environment,
      featureControlsReadable,
      whatsappBookingFeatureEnabled,
      consultationFeatureEnabled,
    });

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
    typeof probeAccount !==
    "function"
  ) {
    throw new TypeError(
      "probeAccount must be provided for Twilio operational readiness."
    );
  }

  try {
    const account =
      await probeAccount();

    const status =
      text(
        account?.status
      ).toLowerCase();

    const active =
      status === "active";

    if (!active) {
      return {
        ...report,
        readyForAcceptance:
          false,
        checks: {
          ...report.checks,
          providerAccountActive:
            false,
        },
        blockers: [
          ...report.blockers,
          "providerAccountActive",
        ],
        providerBlockers: [
          "providerAccountActive",
        ],
        providerProbe: {
          attempted: true,
          success: false,
          status:
            status || "unknown",
        },
        nextSteps: [
          ...report.nextSteps,
          "Resolve the Twilio account status before any controlled WhatsApp acceptance send.",
        ],
      };
    }

    return {
      ...report,
      checks: {
        ...report.checks,
        providerAccountActive:
          true,
      },
      providerProbe: {
        attempted: true,
        success: true,
        status,
      },
      nextSteps: [
        ...report.nextSteps,
        "Run the guarded WhatsApp-only Twilio acceptance test with an approved destination number.",
      ],
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
        providerAccountActive:
          false,
      },
      blockers: [
        ...report.blockers,
        "providerAccountActive",
      ],
      providerBlockers: [
        "providerAccountActive",
      ],
      providerProbe: {
        attempted: true,
        success: false,
        ...failure,
      },
      nextSteps: [
        ...report.nextSteps,
        "Resolve Twilio account authentication/status and rerun production readiness before any WhatsApp acceptance send.",
      ],
    };
  }
}

export default {
  buildTwilioWhatsAppReadinessReport,
  buildTwilioWhatsAppOperationalReadinessReport,
};
