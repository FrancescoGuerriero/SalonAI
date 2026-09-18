export const INTEGRATION_IMPLEMENTATION_STATUS = Object.freeze({
  IMPLEMENTED: "implemented",
  PLANNED: "planned",
});

const definitions = [
  {
    id: "stripe",
    provider: "Stripe",
    category: "payments",
    status: INTEGRATION_IMPLEMENTATION_STATUS.IMPLEMENTED,
    capabilities: [
      "payments.checkout",
      "payments.webhooks",
      "payments.idempotency",
    ],
  },
  {
    id: "twilio",
    provider: "Twilio",
    category: "communications",
    status: INTEGRATION_IMPLEMENTATION_STATUS.IMPLEMENTED,
    capabilities: [
      "messaging.sms",
      "messaging.whatsapp",
      "messaging.status-webhooks",
    ],
  },
  {
    id: "google-calendar",
    provider: "Google Calendar",
    category: "calendar",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["calendar.read", "calendar.write", "calendar.webhooks"],
  },
  {
    id: "microsoft-outlook-calendar",
    provider: "Microsoft Outlook Calendar",
    category: "calendar",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["calendar.read", "calendar.write", "calendar.webhooks"],
  },
  {
    id: "mailchimp",
    provider: "Mailchimp",
    category: "marketing",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["marketing.audiences", "marketing.campaigns"],
  },
  {
    id: "xero",
    provider: "Xero",
    category: "accounting",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["accounting.contacts", "accounting.invoices", "accounting.payments"],
  },
  {
    id: "quickbooks",
    provider: "QuickBooks",
    category: "accounting",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["accounting.contacts", "accounting.invoices", "accounting.payments"],
  },
  {
    id: "pos",
    provider: "POS adapter",
    category: "point-of-sale",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["pos.catalogue", "pos.inventory", "pos.sales"],
  },
  {
    id: "meta-social",
    provider: "Meta",
    category: "social",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["social.instagram", "social.facebook"],
  },
  {
    id: "google-business-profile",
    provider: "Google Business Profile",
    category: "local-presence",
    status: INTEGRATION_IMPLEMENTATION_STATUS.PLANNED,
    capabilities: ["local-profile.read", "local-profile.insights"],
  },
];

function freezeDefinition(definition) {
  return Object.freeze({
    ...definition,
    capabilities: Object.freeze([...definition.capabilities]),
  });
}

export const integrationCatalog = Object.freeze(
  definitions.map(freezeDefinition)
);

export function getIntegrationDefinition(id) {
  return integrationCatalog.find((definition) => definition.id === id) || null;
}
