import {
  getWhatsAppProvider,
  getWhatsAppProviderName,
  isWhatsAppDeliveryEnabled,
} from "./whatsapp/whatsappProviderFactory.js";

export {
  getWhatsAppProviderName,
  isWhatsAppDeliveryEnabled,
};

export async function sendWhatsApp(
  payload = {}
) {
  const {
    name,
    provider,
  } = getWhatsAppProvider();

  if (
    name !== "console" &&
    !isWhatsAppDeliveryEnabled()
  ) {
    const error = new Error(
      "Live WhatsApp delivery is disabled. Set WHATSAPP_DELIVERY_ENABLED=true after configuring the selected provider."
    );

    error.statusCode = 503;
    error.code =
      "WHATSAPP_DELIVERY_DISABLED";

    throw error;
  }

  const result =
    await provider.send(payload);

  return {
    ...result,
    provider:
      result?.provider || name,
  };
}

export default {
  sendWhatsApp,
  getWhatsAppProviderName,
  isWhatsAppDeliveryEnabled,
};
