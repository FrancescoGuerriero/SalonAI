import { registerCapabilityPack } from "./capabilityRegistry.js";

const SERVICE_VERTICALS = ["salon", "spa", "fitness", "plastic-surgery"];
const RETAIL_VERTICALS = ["salon", "spa", "fitness"];

[
  {
    key: "ecommerce-store",
    label: "E-commerce & Online Store",
    moduleClass: "bundle",
    businessPurpose:
      "Provide a branded online storefront, digital merchandising and customer self-service commerce experience while Commerce remains canonical transaction authority.",
    ownedDomains: [
      "ecommerce-storefront",
      "digital-merchandising",
      "online-store-experience",
    ],
    consumesDomains: ["orders", "payments", "checkout", "inventory"],
    supportedVerticals: RETAIL_VERTICALS,
    dependencies: ["commerce"],
    integrationContracts: ["online-storefront"],
  },
  {
    key: "business-planning",
    label: "Business Planning & Forecasting",
    moduleClass: "bundle",
    businessPurpose:
      "Combine governed forecasting, scenarios, targets and planning workspaces so managers can turn business intelligence into supervised plans.",
    ownedDomains: [
      "business-plan",
      "planning-scenario",
      "forecast-plan",
    ],
    consumesDomains: [
      "business-intelligence",
      "analytical-projection",
      "business-advice",
    ],
    supportedVerticals: SERVICE_VERTICALS,
    dependencies: ["analytics", "ai-decision-support"],
    configurationDefinitions: ["planning-horizon", "scenario-policy", "human-review-required"],
  },
  {
    key: "customer-experience",
    label: "Customer Experience",
    moduleClass: "bundle",
    businessPurpose:
      "Own the customer-experience workspace for feedback, service recovery, reputation and experience cases without duplicating CRM or communications authority.",
    ownedDomains: [
      "customer-experience-case",
      "reputation-management",
      "feedback-program",
    ],
    consumesDomains: [
      "customer-360",
      "customer-lifecycle",
      "message-delivery",
      "business-intelligence",
    ],
    supportedVerticals: SERVICE_VERTICALS,
    dependencies: ["crm", "communications", "analytics"],
    requiredPermissions: ["customer-experience:read"],
    configurationDefinitions: ["feedback-policy", "reputation-policy"],
  },
  {
    key: "seller-marketplace",
    label: "Seller & Marketplace Management",
    moduleClass: "bundle",
    businessPurpose:
      "Provide seller-channel portfolio management, marketplace performance and governed marketplace operations while shared integrations, commerce and analytics remain canonical authorities.",
    ownedDomains: [
      "seller-channel-portfolio",
      "marketplace-operations",
      "seller-performance",
    ],
    consumesDomains: [
      "provider-connection",
      "orders",
      "payments",
      "business-intelligence",
      "analytical-projection",
    ],
    supportedVerticals: RETAIL_VERTICALS,
    dependencies: ["integrations", "commerce", "analytics"],
    integrationContracts: ["seller-marketplace-connections"],
    configurationDefinitions: ["marketplace-read-policy", "human-approval-required"],
  },
].forEach((definition) => {
  try {
    registerCapabilityPack(definition);
  } catch (error) {
    if (!/already registered/i.test(error?.message || "")) throw error;
  }
});
