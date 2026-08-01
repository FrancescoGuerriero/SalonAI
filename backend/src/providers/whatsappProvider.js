import twilio from "twilio";

function mode() {
  return String(
    process.env.WHATSAPP_PROVIDER_MODE || "console"
  ).toLowerCase();
}

function whatsappAddress(value) {
  return String(value).startsWith("whatsapp:")
    ? String(value)
    : `whatsapp:${value}`;
}

export async function sendWhatsApp({ to, message }) {
  if (mode() === "console") {
    console.log("[SalonAI WhatsApp]", {
      to,
      message,
    });

    return {
      provider: "console",
      status: "sent",
      messageId: `console_whatsapp_${Date.now()}`,
    };
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const result = await client.messages.create({
    from: whatsappAddress(
      process.env.TWILIO_WHATSAPP_FROM
    ),
    to: whatsappAddress(to),
    body: message,
  });

  return {
    provider: "twilio",
    status: result.status || "sent",
    messageId: result.sid,
  };
}
