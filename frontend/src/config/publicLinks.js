function externalUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}

function whatsappNumber() {
  return String(import.meta.env.VITE_WHATSAPP_NUMBER || "")
    .replace(/\D/g, "");
}

export function getWhatsAppBookingUrl(serviceName = "") {
  const number = whatsappNumber();
  if (!number) return "";

  const baseMessage = String(
    import.meta.env.VITE_WHATSAPP_MESSAGE ||
      "Hello SalonAI, I would like to book an appointment."
  ).trim();

  const message = serviceName
    ? `${baseMessage} Service: ${serviceName}.`
    : baseMessage;

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const socialLinks = [
  {
    label: "Instagram",
    url: externalUrl(import.meta.env.VITE_INSTAGRAM_URL),
  },
  {
    label: "Facebook",
    url: externalUrl(import.meta.env.VITE_FACEBOOK_URL),
  },
  {
    label: "TikTok",
    url: externalUrl(import.meta.env.VITE_TIKTOK_URL),
  },
  {
    label: "YouTube",
    url: externalUrl(import.meta.env.VITE_YOUTUBE_URL),
  },
].filter((item) => item.url);
