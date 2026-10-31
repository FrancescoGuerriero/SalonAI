export const AI_TRAINING_LAYERS = Object.freeze([
  "general",
  "vertical",
  "tenant",
  "continuous-ml",
]);

export const AI_TRAINING_LAYER_POLICY = Object.freeze({
  general: Object.freeze({
    scopeMode: "platform_global",
    mayUseTenantPrivateData: false,
    purpose:
      "Shared AIIBP capabilities, generic business reasoning, tool-use behaviour, safety and platform-wide evaluation assets.",
  }),
  vertical: Object.freeze({
    scopeMode: "cross_business_deidentified",
    mayUseTenantPrivateData: false,
    purpose:
      "Approved de-identified or licensed domain evidence for one business vertical, with explicit governance basis and provenance.",
  }),
  tenant: Object.freeze({
    scopeMode: "single_business",
    mayUseTenantPrivateData: true,
    purpose:
      "Business-specific knowledge, policies, catalogues and evaluation evidence isolated to one Business and its authorised Locations.",
  }),
  "continuous-ml": Object.freeze({
    scopeMode: "single_business",
    mayUseTenantPrivateData: true,
    purpose:
      "Offline candidate model development from governed business-generated observations. Retraining never implies automatic promotion or production inference activation.",
  }),
});

const profiles = new Map();

function clean(value) {
  return String(value || "").trim();
}

function unique(values = []) {
  return Object.freeze([
    ...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean)),
  ]);
}

function normaliseProfile(definition = {}) {
  const key = clean(definition.key).toLowerCase();
  const tenantBlueprintKey = clean(definition.tenantBlueprintKey).toLowerCase();
  const verticalId = clean(definition.verticalId).toLowerCase();

  if (!/^[a-z][a-z0-9-]{1,59}$/.test(key)) {
    throw new TypeError("AI training profile key must be 2-60 lowercase letters, numbers or hyphens.");
  }
  if (!tenantBlueprintKey || !verticalId) {
    throw new TypeError("AI training profile requires tenantBlueprintKey and verticalId.");
  }

  const layerConfiguration = Object.freeze(
    Object.fromEntries(
      AI_TRAINING_LAYERS.map((layer) => {
        const configured = definition.layers?.[layer] || {};
        return [
          layer,
          Object.freeze({
            ...AI_TRAINING_LAYER_POLICY[layer],
            enabled: configured.enabled !== false,
            datasets: unique(configured.datasets),
            knowledgeSources: unique(configured.knowledgeSources),
            evaluationSuites: unique(configured.evaluationSuites),
            tasks: unique(configured.tasks),
          }),
        ];
      })
    )
  );

  return Object.freeze({
    key,
    tenantBlueprintKey,
    verticalId,
    displayName: clean(definition.displayName) || key,
    productionTrainingEnabled: false,
    automaticPromotionEnabled: false,
    automaticInferenceActivationEnabled: false,
    crossTenantPrivateDataReuseEnabled: false,
    layers: layerConfiguration,
  });
}

export function registerAiTrainingProfile(definition) {
  const profile = normaliseProfile(definition);
  if (profiles.has(profile.key)) {
    throw new Error(`AI training profile "${profile.key}" is already registered.`);
  }
  profiles.set(profile.key, profile);
  return profile;
}

export function getAiTrainingProfile(key) {
  return profiles.get(clean(key).toLowerCase()) || null;
}

export function listAiTrainingProfiles() {
  return [...profiles.values()];
}

registerAiTrainingProfile({
  key: "stylish-ai",
  tenantBlueprintKey: "stylish",
  verticalId: "salon",
  displayName: "Stylish AI training profile",
  layers: {
    general: {
      datasets: ["aiibp-general-approved"],
      evaluationSuites: ["aiibp-general-safety", "aiibp-tool-governance"],
    },
    vertical: {
      datasets: ["salon-domain-approved-deidentified"],
      knowledgeSources: ["salon-service-and-booking-domain"],
      evaluationSuites: ["salon-customer-service", "salon-booking-policy"],
    },
    tenant: {
      knowledgeSources: [
        "stylish-service-catalogue",
        "stylish-staff-and-availability",
        "stylish-products",
        "stylish-business-policies",
        "stylish-approved-faq",
      ],
      evaluationSuites: ["stylish-tenant-knowledge", "stylish-ai-receptionist"],
    },
    "continuous-ml": {
      tasks: [
        "no-show-risk",
        "demand-forecasting",
        "retention-risk",
        "campaign-response",
      ],
      datasets: ["stylish-business-generated-governed-snapshots"],
    },
  },
});

registerAiTrainingProfile({
  key: "gut-instinct-ai",
  tenantBlueprintKey: "gut-instinct",
  verticalId: "retail",
  displayName: "Gut Instinct AI training profile",
  layers: {
    general: {
      datasets: ["aiibp-general-approved"],
      evaluationSuites: ["aiibp-general-safety", "aiibp-tool-governance"],
    },
    vertical: {
      datasets: ["retail-domain-approved-deidentified"],
      knowledgeSources: ["retail-commerce-and-customer-service-domain"],
      evaluationSuites: ["retail-customer-service", "retail-commerce-policy"],
    },
    tenant: {
      knowledgeSources: [
        "gut-instinct-product-catalogue",
        "gut-instinct-delivery-and-returns-policies",
        "gut-instinct-approved-brand-content",
        "gut-instinct-marketplace-context",
        "gut-instinct-approved-faq",
      ],
      evaluationSuites: ["gut-instinct-tenant-knowledge", "gut-instinct-customer-concierge"],
    },
    "continuous-ml": {
      tasks: [
        "retail-demand-forecasting",
        "inventory-replenishment",
        "retention-risk",
        "purchase-propensity",
        "campaign-response",
        "marketplace-performance",
      ],
      datasets: ["gut-instinct-business-generated-governed-snapshots"],
    },
  },
});

export default listAiTrainingProfiles;
