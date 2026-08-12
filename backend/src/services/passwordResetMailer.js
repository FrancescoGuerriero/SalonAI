import nodemailer from "nodemailer";

import { env } from "../config/env.js";

function boolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function smtpConfiguration() {
  return {
    host: String(process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: boolean(process.env.SMTP_SECURE, false),
    requireTLS: boolean(process.env.SMTP_REQUIRE_TLS, true),
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

export function passwordResetEmailEnabled() {
  const providerMode = String(
    process.env.EMAIL_PROVIDER_MODE || "mock"
  ).toLowerCase();

  return (
    boolean(process.env.EMAIL_DELIVERY_ENABLED, false) &&
    providerMode !== "mock"
  );
}

export async function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
}) {
  if (!passwordResetEmailEnabled()) {
    if (!env.isProduction) {
      console.info(
        `[SalonAI development] Password reset link for ${email}: ${resetUrl}`
      );
    }

    return {
      delivered: false,
      mode: "development",
    };
  }

  const config = smtpConfiguration();

  if (
    !config.host ||
    !config.user ||
    !config.password ||
    !config.fromAddress
  ) {
    throw new Error(
      "Password reset email delivery is enabled but SMTP is incomplete."
    );
  }

  const transporter = nodemailer.createTransport({
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
      rejectUnauthorized: boolean(
        process.env.SMTP_REJECT_UNAUTHORIZED,
        true
      ),
    },
  });

  const recipientName = String(name || "there").trim() || "there";
  const safeRecipientName = escapeHtml(recipientName);
  const safeResetUrl = escapeHtml(resetUrl);

  await transporter.sendMail({
    from: `${config.fromName} <${config.fromAddress}>`,
    to: email,
    replyTo: config.replyTo || undefined,
    subject: "Reset your SalonAI password",
    text: [
      `Hello ${recipientName},`,
      "",
      "A password reset was requested for your SalonAI account.",
      `Open this link to choose a new password: ${resetUrl}`,
      "",
      `This link expires in ${env.passwordResetMinutes} minutes.`,
      "If you did not request this reset, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Hello ${safeRecipientName},</p>
      <p>A password reset was requested for your SalonAI account.</p>
      <p><a href="${safeResetUrl}">Reset your password</a></p>
      <p>This link expires in ${env.passwordResetMinutes} minutes.</p>
      <p>If you did not request this reset, you can ignore this email.</p>
    `,
  });

  return {
    delivered: true,
    mode: "smtp",
  };
}
