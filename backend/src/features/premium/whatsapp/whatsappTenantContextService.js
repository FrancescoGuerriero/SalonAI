import Location from "../../../models/Location.js";
import {
  getWhatsAppProviderName,
} from "../../../providers/whatsapp/whatsappProviderFactory.js";
import WhatsAppChannelBinding from "./WhatsAppChannelBinding.js";

function text(value) {
  return String(value ?? "").trim();
}

function normaliseTwilioDestination(value) {
  let result = text(value)
    .replace(/^whatsapp:/i, "")
    .replace(/[\s()-]/g, "");
  if (result.startsWith("00")) result = `+${result.slice(2)}`;
  if (result && !result.startsWith("+")) result = `+${result}`;
  return /^\+[1-9]\d{7,14}$/.test(result) ? result : "";
}

function metaPhoneNumberId(body = {}) {
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = text(change?.value?.metadata?.phone_number_id);
      if (value) return value.slice(0, 180);
    }
  }
  return "";
}

export function extractWhatsAppDestination(
  request,
  provider = getWhatsAppProviderName()
) {
  if (provider === "twilio") {
    const destinationKey = normaliseTwilioDestination(
      request?.body?.To ?? request?.body?.to
    );
    return destinationKey ? Object.freeze({ provider, destinationKey }) : null;
  }

  if (provider === "meta") {
    const destinationKey = metaPhoneNumberId(request?.body || {});
    return destinationKey ? Object.freeze({ provider, destinationKey }) : null;
  }

  return null;
}

export async function resolveWhatsAppTenantContext(
  request,
  { provider = getWhatsAppProviderName() } = {}
) {
  const destination = extractWhatsAppDestination(request, provider);
  if (!destination) return null;

  const binding = await WhatsAppChannelBinding.findOne({
    provider: destination.provider,
    destinationKey: destination.destinationKey,
    status: "active",
  })
    .select("business location provider destinationKey")
    .lean();

  if (!binding) return null;

  const location = await Location.findOne({
    _id: binding.location,
    business: binding.business,
    status: "active",
  })
    .select("_id business")
    .lean();

  if (!location) return null;

  return Object.freeze({
    business: binding.business,
    location: binding.location,
    provider: binding.provider,
    destinationKey: binding.destinationKey,
  });
}

export default {
  extractWhatsAppDestination,
  resolveWhatsAppTenantContext,
};
