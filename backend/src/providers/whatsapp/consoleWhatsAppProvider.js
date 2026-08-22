export async function sendConsoleWhatsApp({
  to,
  message = "",
  contentSid = "",
  templateName = "",
} = {}) {
  const body = String(message || "").trim();
  const template = String(
    templateName || contentSid || ""
  ).trim();

  console.log("[SalonAI WhatsApp:console]", {
    to,
    type: template ? "template" : "freeform",
    template: template || undefined,
    message: template ? undefined : body,
  });

  return {
    provider: "console",
    status: "sent",
    messageId: `console_whatsapp_${Date.now()}`,
    template: Boolean(template),
  };
}

export default {
  send: sendConsoleWhatsApp,
};