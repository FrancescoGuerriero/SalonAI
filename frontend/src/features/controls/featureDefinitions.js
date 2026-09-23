export const FEATURE_DEFINITIONS = [
  ["online-booking", "Online booking", "Bookings"],
  ["whatsapp-booking", "WhatsApp booking", "Bookings"],
  ["appointments", "Appointment self-service", "Bookings"],
  ["public-team", "Public team profiles", "Public website"],
  ["online-shop", "Online shop", "Commerce"],
  ["service-packages", "Service packages", "Commerce"],
  ["reviews", "Reviews and ratings", "Customer experience"],
  ["favourites", "Customer favourites", "Customer experience"],
  ["offers", "Offers and promotions", "Customer experience"],
  ["wallet", "Gift cards and wallet", "Customer experience"],
  ["loyalty", "Loyalty programme", "Customer experience"],
  ["inbox", "Customer inbox", "Customer experience"],
  ["salon-discovery", "Salon discovery preferences", "Customer experience"],
  ["consultation", "Digital consultation", "Customer experience"],
  ["inspiration", "Inspiration board", "Customer experience"],
  ["referrals", "Referral programme", "Customer experience"],
  ["feedback", "Product feedback", "Customer experience"],
  ["notifications", "Notification centre", "Communications"],
  ["communications", "Campaign communications", "Communications"],
  ["retention-automation", "Retention automation", "Communications"],
  ["inventory-purchasing", "Inventory and purchasing", "Operations"],
  ["ai-tools", "SalonAI management tools", "SalonAI"],
  ["salon-chatbot", "SalonAI customer assistant", "SalonAI"],
  ["premium-analytics", "Premium analytics", "SalonAI"],
  ["pwa", "Installable app", "Digital experience"],
  ["seo", "Search visibility tools", "Digital experience"],
  ["analytics", "Analytics transparency", "Digital experience"],
  ["performance", "Performance diagnostics", "Digital experience"],
  ["responsive", "Responsive QA", "Digital experience"],
  ["testing", "Quality centre", "Digital experience"],
  ["release", "Release readiness", "Digital experience"],
  ["privacy", "Privacy and consent centre", "Required controls"],
].map(([id, label, category]) => ({ id, label, category, defaultEnabled: true }));

export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(FEATURE_DEFINITIONS.map(({ id, defaultEnabled }) => [id, defaultEnabled]))
);

export const ROADMAP_FEATURE_CONTROL = Object.freeze({
  privacy: "privacy",
  reviews: "reviews",
  favourites: "favourites",
  offers: "offers",
  wallet: "wallet",
  loyalty: "loyalty",
  appointments: "appointments",
  inbox: "inbox",
  pwa: "pwa",
  seo: "seo",
  analytics: "analytics",
  performance: "performance",
  responsive: "responsive",
  testing: "testing",
  release: "release",
  "salon-discovery": "salon-discovery",
  consultation: "consultation",
  inspiration: "inspiration",
  referrals: "referrals",
  feedback: "feedback",
});

export function resolveFeatureFlags(payload) {
  const incoming = payload?.features;

  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return { ...DEFAULT_FEATURE_FLAGS };
  }

  return Object.fromEntries(
    FEATURE_DEFINITIONS.map(({ id, defaultEnabled }) => [
      id,
      typeof incoming[id] === "boolean" ? incoming[id] : defaultEnabled,
    ])
  );
}
