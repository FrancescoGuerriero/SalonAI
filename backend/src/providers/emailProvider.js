import nodemailer from "nodemailer";

function providerMode() {
  return String(
    process.env.EMAIL_PROVIDER_MODE || "mock"
  )
    .trim()
    .toLowerCase();
}

function boolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function deliveryEnabled() {
  return boolean(process.env.EMAIL_DELIVERY_ENABLED, false);
}

function simulatedResult(mode, payload) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[SalonAI email:${mode}]`, payload);
  }

  return {
    provider: mode,
    status: "mocked",
    delivered: false,
    messageId: `${mode}_email_${Date.now()}`,
  };
}

function smtpConfiguration() {
  return {
    host: String(process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: boolean(process.env.SMTP_SECURE, false),
    requireTLS: boolean(process.env.SMTP_REQUIRE_TLS, true),
    rejectUnauthorized: boolean(
      process.env.SMTP_REJECT_UNAUTHORIZED,
      true
    ),
    user: String(process.env.SMTP_USER || "").trim(),
    password: String(process.env.SMTP_PASSWORD || ""),
    fromName: String(process.env.EMAIL_FROM_NAME || "SalonAI").trim(),
    fromAddress: String(
      process.env.EMAIL_FROM_ADDRESS ||
        process.env.EMAIL_FROM ||
        process.env.SMTP_USER ||
        ""
    ).trim(),
    replyTo: String(process.env.EMAIL_REPLY_TO || "").trim(),
  };
}

function assertSmtpConfiguration(config) {
  if (
    !config.host ||
    !Number.isFinite(config.port) ||
    config.port <= 0 ||
    !config.user ||
    !config.password ||
    !config.fromAddress
  ) {
    throw new Error(
      "SMTP email delivery is enabled but SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM_ADDRESS/EMAIL_FROM are not fully configured."
    );
  }
}

function transport() {
  const config = smtpConfiguration();
  assertSmtpConfiguration(config);

  return {
    config,
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      auth: {
        user: config.user,
        pass: config.password,
      },
      connectionTimeout: Number(
        process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000
      ),
      greetingTimeout: Number(
        process.env.SMTP_GREETING_TIMEOUT_MS || 10000
      ),
      socketTimeout: Number(
        process.env.SMTP_SOCKET_TIMEOUT_MS || 30000
      ),
      tls: {
        rejectUnauthorized: config.rejectUnauthorized,
      },
    }),
  };
}

export function emailDeliveryStatus() {
  const mode = providerMode();

  return {
    mode,
    enabled: deliveryEnabled(),
    live: deliveryEnabled() && mode === "smtp",
  };
}

export async function verifyEmailTransport() {
  const status = emailDeliveryStatus();

  if (!status.live) {
    return {
      ...status,
      verified: false,
    };
  }

  const { transporter } = transport();
  await transporter.verify();

  return {
    ...status,
    verified: true,
  };
}

export async function sendEmail({
  to,
  subject,
  message,
  html,
}) {
  const mode = providerMode();

  if (!deliveryEnabled()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Real email delivery is disabled in production. Set EMAIL_DELIVERY_ENABLED=true after configuring SMTP."
      );
    }

    return simulatedResult(mode, {
      to,
      subject,
      message,
    });
  }

  if (["mock", "console"].includes(mode)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Production email delivery cannot use mock or console mode. Set EMAIL_PROVIDER_MODE=smtp."
      );
    }

    return simulatedResult(mode, {
      to,
      subject,
      message,
    });
  }

  if (mode !== "smtp") {
    throw new Error(
      "EMAIL_PROVIDER_MODE must be mock, console or smtp."
    );
  }

  const { config, transporter } = transport();
  const result = await transporter.sendMail({
    from: `${config.fromName} <${config.fromAddress}>`,
    replyTo: config.replyTo || undefined,
    to,
    subject,
    text: message,
    html,
  });

  return {
    provider: "smtp",
    status: "sent",
    delivered: true,
    messageId: result.messageId,
  };
}
