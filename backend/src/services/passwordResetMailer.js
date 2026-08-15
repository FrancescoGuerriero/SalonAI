import { env } from "../config/env.js";
import {
  emailDeliveryStatus,
  sendEmail,
} from "../providers/emailProvider.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function passwordResetEmailEnabled() {
  return emailDeliveryStatus().live;
}

export async function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
}) {
  const recipientName = String(name || "there").trim() || "there";
  const safeRecipientName = escapeHtml(recipientName);
  const safeResetUrl = escapeHtml(resetUrl);

  const result = await sendEmail({
    to: email,
    subject: "Reset your SalonAI password",
    message: [
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
    delivered: Boolean(result?.delivered),
    mode: result?.provider || emailDeliveryStatus().mode,
    messageId: result?.messageId || "",
  };
}
