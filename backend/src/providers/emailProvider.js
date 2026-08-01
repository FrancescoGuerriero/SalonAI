import nodemailer from "nodemailer";

function mode() {
  return String(
    process.env.EMAIL_PROVIDER_MODE || "console"
  ).toLowerCase();
}

function consoleResult(payload) {
  console.log("[SalonAI email]", payload);

  return {
    provider: "console",
    status: "sent",
    messageId: `console_email_${Date.now()}`,
  };
}

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure:
      String(process.env.SMTP_SECURE).toLowerCase() ===
      "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
  });
}

export async function sendEmail({
  to,
  subject,
  message,
  html,
}) {
  if (mode() === "console") {
    return consoleResult({
      to,
      subject,
      message,
    });
  }

  const result = await transport().sendMail({
    from:
      process.env.EMAIL_FROM ||
      "SalonAI <no-reply@example.com>",
    to,
    subject,
    text: message,
    html,
  });

  return {
    provider: "smtp",
    status: "sent",
    messageId: result.messageId,
  };
}
