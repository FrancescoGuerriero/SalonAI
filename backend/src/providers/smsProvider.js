import twilio from "twilio";

function mode() {
  return String(
    process.env.SMS_PROVIDER_MODE || "console"
  ).toLowerCase();
}

export async function sendSms({ to, message }) {
  if (mode() === "console") {
    console.log("[SalonAI SMS]", {
      to,
      message,
    });

    return {
      provider: "console",
      status: "sent",
      messageId: `console_sms_${Date.now()}`,
    };
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const result = await client.messages.create({
    from: process.env.TWILIO_SMS_FROM,
    to,
    body: message,
  });

  return {
    provider: "twilio",
    status: result.status || "sent",
    messageId: result.sid,
  };
}
