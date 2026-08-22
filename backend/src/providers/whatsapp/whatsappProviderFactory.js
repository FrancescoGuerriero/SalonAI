import consoleProvider from "./consoleWhatsAppProvider.js";
import metaProvider from "./metaWhatsAppProvider.js";
import twilioProvider from "./twilioWhatsAppProvider.js";

const PROVIDERS = Object.freeze({
  console: consoleProvider,
  meta: metaProvider,
  twilio: twilioProvider,
});

function value(input) {
  return String(input || "")
    .trim()
    .toLowerCase();
}

export function getWhatsAppProviderName() {
  const configured =
    value(process.env.WHATSAPP_PROVIDER);

  if (configured) {
    if (!PROVIDERS[configured]) {
      const error = new Error(
        "WHATSAPP_PROVIDER must be console, meta or twilio."
      );
      error.statusCode = 500;
      error.code =
        "WHATSAPP_PROVIDER_INVALID";
      throw error;
    }

    return configured;
  }

  /*
   * Backwards compatibility while Phase 8.11A
   * migrates existing deployments.
   */
  const legacy =
    value(
      process.env.WHATSAPP_PROVIDER_MODE
    ) || "console";

  if (
    [
      "console",
      "mock",
      "sandbox",
    ].includes(legacy)
  ) {
    return "console";
  }

  if (
    [
      "twilio",
      "live",
    ].includes(legacy)
  ) {
    return "twilio";
  }

  return "console";
}

export function isWhatsAppDeliveryEnabled() {
  const configured =
    process.env
      .WHATSAPP_DELIVERY_ENABLED;

  if (configured !== undefined) {
    return (
      value(configured) === "true"
    );
  }

  /*
   * Preserve legacy behaviour until the new
   * configuration is explicitly installed.
   */
  return !value(
    process.env.WHATSAPP_PROVIDER
  );
}

export function getWhatsAppProvider() {
  const name =
    getWhatsAppProviderName();

  return {
    name,
    provider: PROVIDERS[name],
  };
}

export default {
  getWhatsAppProvider,
  getWhatsAppProviderName,
  isWhatsAppDeliveryEnabled,
};