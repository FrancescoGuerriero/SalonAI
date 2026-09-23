import SystemSetting from "../models/SystemSetting.js";

export const FEATURE_SETTING_PREFIX = "feature.";
export const FEATURE_SETTING_SUFFIX = ".enabled";

export const FEATURE_CONTROLS = Object.freeze([
  { id: "online-booking", label: "Online booking", category: "Bookings", description: "Allow customers to choose eligible staff and submit appointments.", defaultEnabled: true },
  { id: "whatsapp-booking", label: "WhatsApp booking", category: "Bookings", description: "Allow WhatsApp-assisted booking and its management workspace.", defaultEnabled: true },
  { id: "appointments", label: "Appointment self-service", category: "Bookings", description: "Allow customers to request appointment cancellations or rescheduling.", defaultEnabled: true },
  { id: "public-team", label: "Public team profiles", category: "Public website", description: "Show published, active and bookable employees on public team pages.", defaultEnabled: true },
  { id: "online-shop", label: "Online shop", category: "Commerce", description: "Expose the product catalogue, cart, checkout and customer orders.", defaultEnabled: true },
  { id: "service-packages", label: "Service packages", category: "Commerce", description: "Allow customers to discover and purchase prepaid service bundles. Existing package credits remain retained and viewable when sales are disabled.", defaultEnabled: true },
  { id: "group-bookings", label: "Group bookings", category: "Bookings", description: "Enable organiser-led multi-participant bookings while each participant remains a canonical appointment.", defaultEnabled: true },
  { id: "service-trials", label: "Service trials", category: "Bookings", description: "Enable governed trial offers, eligibility controls and trial-to-standard-service conversion tracking.", defaultEnabled: true },
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

export const FEATURE_CONTROL_IMPACTS = Object.freeze({
  "online-booking": {
    controlMode: "capability",
    impactScopes: ["Customer action", "Public booking API"],
    enforcement: "Customer appointment creation, booking staff lists and staff availability.",
  },
  "whatsapp-booking": {
    controlMode: "capability",
    impactScopes: ["Customer channel", "Management workspace", "API"],
    enforcement: "WhatsApp-assisted booking conversations and management endpoints.",
  },
  appointments: {
    controlMode: "capability",
    impactScopes: ["Customer action"],
    enforcement: "Customer cancellation and rescheduling request submission.",
  },
  "public-team": {
    controlMode: "capability",
    impactScopes: ["Public website", "Public API"],
    enforcement: "Published public staff profiles. Internal staff-profile management remains available.",
  },
  "online-shop": {
    controlMode: "capability",
    impactScopes: ["Public website", "Checkout", "Customer orders", "API"],
    enforcement: "Public products, product detail, cart/checkout and customer online-order actions.",
  },
  "service-packages": {
    controlMode: "capability",
    impactScopes: ["Public website", "Package sales", "Checkout", "API"],
    enforcement: "Published package discovery and new package purchases. Existing customer entitlements, redemption history and management records are retained and remain viewable.",
  },
  "group-bookings": {
    controlMode: "capability",
    impactScopes: ["Management workspace", "Appointment API"],
    enforcement: "New group creation and participant orchestration. Existing canonical participant appointments remain retained and manageable through ordinary appointment workflows.",
  },
  "service-trials": {
    controlMode: "capability",
    impactScopes: ["Management workspace", "Appointment API"],
    enforcement: "Trial-definition management, new trial bookings and conversion tracking. Existing canonical appointments and retained trial audit records remain available through ordinary appointment history.",
  },
  reviews: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Review history visibility in the customer aggregate and new verified review submissions.",
  },
  favourites: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Saved-favourite visibility plus add/remove actions.",
  },
  offers: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Public offers, claimed-offer visibility and offer-claim actions. Management records are retained.",
  },
  wallet: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Customer gift-card wallet visibility and wallet mutations; retained salon records are not deleted.",
  },
  loyalty: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "API"],
    enforcement: "Customer loyalty balances/activity and loyalty endpoints.",
  },
  inbox: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Customer inbox visibility and message-read actions.",
  },
  "salon-discovery": {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Customer salon-discovery preference visibility and updates.",
  },
  consultation: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Customer consultation history visibility and new consultation submissions. Management history is retained.",
  },
  inspiration: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Private inspiration-board visibility and add/remove actions.",
  },
  referrals: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "API"],
    enforcement: "Customer referral history and referral creation/qualification endpoints.",
  },
  feedback: {
    controlMode: "capability",
    impactScopes: ["Customer experience", "Customer API"],
    enforcement: "Customer feedback history and new feedback submissions. Management history is retained.",
  },
  notifications: {
    controlMode: "capability",
    impactScopes: ["Customer notifications", "Management workspace", "API"],
    enforcement: "Managed notification and browser-push capabilities.",
  },
  communications: {
    controlMode: "capability",
    impactScopes: ["Management workspace", "Delivery APIs"],
    enforcement: "Campaign email/SMS, templates, schedules and delivery management.",
  },
  "retention-automation": {
    controlMode: "capability",
    impactScopes: ["Management workspace", "Automation API"],
    enforcement: "Automated retention journeys and rule execution surfaces.",
  },
  "inventory-purchasing": {
    controlMode: "capability",
    impactScopes: ["Management workspace", "Operations API"],
    enforcement: "Supplier, purchase-order and replenishment capabilities. Core retained product records remain intact.",
  },
  "ai-tools": {
    controlMode: "capability",
    impactScopes: ["Management workspace", "AI API"],
    enforcement: "SalonAI management recommendations, summaries, segmentation and forecasting tools.",
  },
  "salon-chatbot": {
    controlMode: "capability",
    impactScopes: ["Customer website", "Assistant API"],
    enforcement: "Customer assistant visibility and assistant-message processing.",
  },
  "premium-analytics": {
    controlMode: "capability",
    impactScopes: ["Management workspace", "Analytics API"],
    enforcement: "Premium feature-performance analytics.",
  },
  pwa: {
    controlMode: "workspace",
    impactScopes: ["Customer workspace"],
    enforcement: "Controls access to installable-app guidance and diagnostics; it does not uninstall an already installed browser PWA.",
  },
  seo: {
    controlMode: "workspace",
    impactScopes: ["Customer workspace"],
    enforcement: "Controls access to search-visibility guidance and diagnostics.",
  },
  analytics: {
    controlMode: "workspace",
    impactScopes: ["Customer workspace"],
    enforcement: "Controls the analytics-transparency workspace. Privacy consent remains independently available.",
  },
  performance: {
    controlMode: "workspace",
    impactScopes: ["Customer workspace"],
    enforcement: "Controls access to browser performance diagnostics.",
  },
  responsive: {
    controlMode: "workspace",
    impactScopes: ["Customer workspace"],
    enforcement: "Controls access to responsive-experience diagnostics; it does not disable responsive CSS.",
  },
  testing: {
    controlMode: "workspace",
    impactScopes: ["Customer workspace"],
    enforcement: "Controls access to safe browser smoke-check tooling; CI release gates remain independent.",
  },
  release: {
    controlMode: "workspace",
    impactScopes: ["Customer workspace"],
    enforcement: "Controls access to release-readiness diagnostics; it does not enable or disable deployment workflows.",
  },
  privacy: {
    controlMode: "required",
    impactScopes: ["Customer privacy", "Required control"],
    enforcement: "Essential privacy and consent controls are always available and cannot be disabled.",
  },
});

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
      ...(FEATURE_CONTROL_IMPACTS[
        definition.id
      ] || {
        controlMode:
          "capability",
        impactScopes: [],
        enforcement:
          definition.description,
      }),
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
