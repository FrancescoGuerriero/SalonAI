import { sendEmail } from "./emailProvider.js";
import { sendSms } from "./smsProvider.js";
import { sendWhatsApp } from "./whatsappProvider.js";

export async function sendCommunication(
  channel,
  payload
) {
  switch (channel) {
    case "email":
      return sendEmail(payload);

    case "sms":
      return sendSms(payload);

    case "whatsapp":
      return sendWhatsApp(payload);

    case "phone":
    case "in_app":
      console.log(`[SalonAI ${channel}]`, payload);

      return {
        provider: "console",
        status: "sent",
        messageId: `console_${channel}_${Date.now()}`,
      };

    default:
      throw new Error(
        `Unsupported communication channel: ${channel}`
      );
  }
}
