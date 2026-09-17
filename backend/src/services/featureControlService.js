import SystemSetting from "../models/SystemSetting.js";

export const FEATURE_SETTING_PREFIX = "feature.";
export const FEATURE_SETTING_SUFFIX = ".enabled";

export const FEATURE_CONTROLS = Object.freeze([
  { id: "online-booking", label: "Online booking", category: "Bookings", description: "Allow customers to choose eligible staff and submit appointments.", defaultEnabled: true },
  { id: "whatsapp-booking", label: "WhatsApp booking", category: "Bookings", description: "Allow WhatsApp-assisted booking and its management workspace.", defaultEnabled: true },
  { id: "appointments", label: "Appointment self-service", category: "Bookings", description: "Allow customers to request appointment cancellations or rescheduling.", defaultEnabled: true },
  { id: "public-team", label: "Public team profiles", category: "Public website", description: "Show published, active and bookable employees on public team pages.", defaultEnabled: true },
  { id: "online-shop", label: "Online shop", category: "Commerce", description: "Expose the product catalogue, cart, checkout and customer orders.", defaultEnabled: true },
  { id: "reviews", label: "Reviews and ratings", category: "Customer experience", description: "Allow verified customers to submit reviews for moderation.", defaultEnabled: true },
  { id: "favourites", label: "Customer favourites", category: "Customer experience", description: "Allow customers to save services, stylists and products.", defaultEnabled: true },
  { id: "offers", label: "Offers and promotions", category: "Customer experience", description: "Allow customers to discover and claim active salon offers.", defaultEnabled: true },
  { id: "wallet", label: "Gift cards and wallet", category: "Customer experience", description: "Enable gift-card management and the customer wallet.", defaultEnabled: true },
  { id: "loyalty", label: "Loyalty programme", category: "Customer experience", description: "Enable loyalty balances, tiers, awards and redemptions.", defaultEnabled: true },
  { id: "inbox", label: "Customer inbox", category: "Customer experience", description: "Expose customer-specific booking, order and salon notifications.", defaultEnabled: true },
  { id: "salon-discovery", label: "Salon discovery preferences", category: "Customer experience", description: "Allow customers to save location, service and timing preferences.", defaultEnabled: true },
  { id: "consultation", label: "Digital consultation", category: "Customer experience", description: "Allow customers to submit hair goals, history and sensitivities.", defaultEnabled: true },
  { id: "inspiration", label: "Inspiration board", category: "Customer experience", description: "Allow customers to save private hairstyle references and notes.", defaultEnabled: true },
  { id: "referrals", label: "Referral programme", category: "Customer experience", description: "Enable referral codes, qualification and reward tracking.", defaultEnabled: true },
  { id: "feedback", label: "Product feedback", category: "Customer experience", description: "Allow structured customer feedback and management triage.", defaultEnabled: true },
  { id: "notifications", label: "Notification centre", category: "Communications", description: "Enable managed notifications and browser push delivery.", defaultEnabled: true },
  { id: "communications", label: "Campaign communications", category: "Communications", description: "Enable email, SMS, templates, campaigns and scheduled delivery.", defaultEnabled: true },
  { id: "retention-automation", label: "Retention automation", category: "Communications", description: "Enable automated customer retention journeys and rules.", defaultEnabled: true },
  { id: "inventory-purchasing", label: "Inventory and purchasing", category: "Operations", description: "Enable supplier, purchasing and replenishment workspaces.", defaultEnabled: true },
  { id: "ai-tools", label: "SalonAI management tools", category: "SalonAI", description: "Enable AI recommendations, summaries, segmentation and forecasting.", defaultEnabled: true },
  { id: "salon-chatbot", label: "SalonAI customer assistant", category: "SalonAI", description: "Show the customer assistant and accept assistant messages.", defaultEnabled: true },
  { id: "premium-analytics", label: "Premium analytics", category: "SalonAI", description: "Enable feature adoption and premium performance analytics.", defaultEnabled: true },
  { id: "pwa", label: "Installable app", category: "Digital experience", description: "Expose the installable application guidance and diagnostics.", defaultEnabled: true },
  { id: "seo", label: "Search visibility tools", category: "Digital experience", description: "Expose public search-visibility checks and guidance.", defaultEnabled: true },
  { id: "analytics", label: "Analytics transparency", category: "Digital experience", description: "Expose customer-facing analytics and consent transparency.", defaultEnabled: true },
  { id: "performance", label: "Performance diagnostics", category: "Digital experience", description: "Expose live browser performance diagnostics.", defaultEnabled: true },
  { id: "responsive", label: "Responsive QA", category: "Digital experience", description: "Expose viewport and responsive-experience checks.", defaultEnabled: true },
  { id: "testing", label: "Quality centre", category: "Digital experience", description: "Expose safe browser smoke checks for authenticated customers.", defaultEnabled: true },
  { id: "release", label: "Release readiness", category: "Digital experience", description: "Expose deployment, HTTPS and API readiness checks.", defaultEnabled: true },
  { id: "privacy", label: "Privacy and consent centre", category: "Required controls", description: "Keep essential privacy and consent controls available to every customer.", defaultEnabled: true, required: true },
]);

export const FEATURE_CONTROL_MAP = Object.freeze(
  Object.fromEntries(FEATURE_CONTROLS.map((definition) => [definition.id, definition]))
);

export function featureSettingKey(featureId) {
  return `${FEATURE_SETTING_PREFIX}${featureId}${FEATURE_SETTING_SUFFIX}`;
}

export function requireKnownFeature(featureId) {
  const definition = FEATURE_CONTROL_MAP[String(featureId || "").trim()];

  if (!definition) {
    const error = new Error("The requested feature control is not supported.");
    error.statusCode = 404;
    throw error;
  }

  return definition;
}

export function normaliseFeatureControlUpdate(featureId, body = {}) {
  const definition = requireKnownFeature(featureId);

  if (definition.required) {
    const error = new Error("This required control cannot be disabled or overridden.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof body.enabled !== "boolean") {
    const error = new Error("enabled must be a boolean value.");
    error.statusCode = 400;
    throw error;
  }

  return {
    definition,
    key: featureSettingKey(definition.id),
    enabled: body.enabled,
  };
}

export function resolveFeatureControls(settings = []) {
  const values = new Map(
    (Array.isArray(settings) ? settings : []).map((setting) => [setting.key, setting])
  );

  return FEATURE_CONTROLS.map((definition) => {
    const setting = values.get(featureSettingKey(definition.id));
    const hasAdminOverride = !definition.required && typeof setting?.value === "boolean";

    return {
      ...definition,
      enabled: definition.required
        ? true
        : hasAdminOverride
          ? setting.value
          : definition.defaultEnabled,
      source: hasAdminOverride ? "admin" : "code-default",
      updatedAt: setting?.updatedAt || null,
      updatedBy: setting?.updatedBy || null,
    };
  });
}

export async function listResolvedFeatureControls() {
  if (SystemSetting.db.readyState !== 1) {
    return resolveFeatureControls([]);
  }

  const keys = FEATURE_CONTROLS.map(({ id }) => featureSettingKey(id));
  const settings = await SystemSetting.find({ key: { $in: keys } })
    .populate("updatedBy", "name email")
    .lean();

  return resolveFeatureControls(settings);
}

export async function isFeatureEnabled(featureId) {
  const definition = requireKnownFeature(featureId);

  if (definition.required) {
    return true;
  }

  /*
   * The application has several source-level and unauthenticated route tests
   * that intentionally run without MongoDB. In that state there cannot be a
   * persisted administrator override, so the explicit code default applies.
   * A connected production process always reads the MongoDB value.
   */
  if (SystemSetting.db.readyState !== 1) {
    return definition.defaultEnabled;
  }

  const setting = await SystemSetting.findOne({
    key: featureSettingKey(definition.id),
  }).lean();

  return typeof setting?.value === "boolean"
    ? setting.value
    : definition.defaultEnabled;
}

export function createRequireFeature(enabledResolver = isFeatureEnabled) {
  return function requireFeature(featureId) {
    requireKnownFeature(featureId);

    return async function featureControlMiddleware(request, response, next) {
      try {
        if (await enabledResolver(featureId)) {
          return next();
        }

        const error = new Error("This feature is currently disabled by the salon administrator.");
        error.statusCode = 404;
        error.code = "FEATURE_DISABLED";
        error.details = { featureId };
        return next(error);
      } catch (error) {
        return next(error);
      }
    };
  };
}

export const requireFeature = createRequireFeature();
