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
  const providerMode = mode();

  if (["console", "mock", "sandbox"].includes(providerMode)) {
    console.log("[SalonAI WhatsApp]", {
      to,
      message,
    });

    return {
      provider: providerMode,
      status: "sent",
      messageId: `${providerMode}_whatsapp_${Date.now()}`,
    };
  }

  if (!["twilio", "live"].includes(providerMode)) {
    const error = new Error(
      "WHATSAPP_PROVIDER_MODE must be mock, console, sandbox, twilio or live."
    );
    error.statusCode = 500;
    error.code = "WHATSAPP_PROVIDER_MODE_INVALID";
    throw error;
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_WHATSAPP_FROM
  ) {
    const error = new Error(
      "Twilio WhatsApp credentials and sender are required for live delivery."
    );
    error.statusCode = 500;
    error.code = "WHATSAPP_TWILIO_CONFIGURATION_MISSING";
    throw error;
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
