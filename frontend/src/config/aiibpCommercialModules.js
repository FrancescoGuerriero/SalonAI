export const AIIBP_COMMERCIAL_MODULES = Object.freeze([
  { key: "appointments", label: "Appointments & Booking", group: "Operations", summary: "Booking, availability, appointment lifecycle, queues and front-desk workflows." },
  { key: "staff", label: "Workforce & Staff", group: "Operations", summary: "Employees, staff profiles, assignments, rotas and workforce operations." },
  { key: "services", label: "Service Catalogue", group: "Operations", summary: "Services, procedures, pricing configuration and delivery definitions." },
  { key: "commerce", label: "Commerce", group: "Commerce", summary: "Orders, checkout, payments, refunds and canonical transaction state." },
  { key: "ecommerce-store", label: "E-commerce & Online Store", group: "Commerce", summary: "Branded storefront, digital merchandising and customer self-service shopping.", newCommercial: true },
  { key: "memberships", label: "Memberships", group: "Commerce", summary: "Recurring membership contracts, lifecycle and entitlement-aware experiences." },
  { key: "inventory", label: "Inventory & Purchasing", group: "Operations", summary: "Stock, purchasing, suppliers, replenishment and inventory operations." },
  { key: "loyalty", label: "Loyalty", group: "Customer", summary: "Points, balances, earning rules and redemption." },
  { key: "communications", label: "Communications", group: "Customer", summary: "Consent-aware customer messaging across approved channels." },
  { key: "calendar", label: "Calendar Integration", group: "Integrations", summary: "External calendar connectivity while booking remains canonical." },
  { key: "integrations", label: "Integration Hub", group: "Integrations", summary: "Provider connections, secure credentials, synchronisation and health controls." },
  { key: "crm", label: "CRM & Customer Intelligence", group: "Customer", summary: "Customer 360, lifecycle, segmentation, journeys and relationship intelligence." },
  { key: "customer-experience", label: "Customer Experience", group: "Customer", summary: "Feedback, reputation, service recovery and customer-experience case management.", newCommercial: true },
  { key: "marketing", label: "Marketing", group: "Growth", summary: "Data connections, campaigns, audiences, attribution and governed automation." },
  { key: "seller-marketplace", label: "Seller & Marketplace Management", group: "Commerce", summary: "Marketplace account portfolio, seller operations and marketplace performance.", newCommercial: true },
  { key: "analytics", label: "Analytics & Business Intelligence", group: "Intelligence", summary: "Governed KPIs, dashboards, analytical projections and reporting." },
  { key: "business-planning", label: "Business Planning & Forecasting", group: "Intelligence", summary: "Forecasts, targets, scenarios and AI-assisted business planning.", newCommercial: true },
  { key: "ai-decision-support", label: "AI Business Adviser", group: "AI Assistants", summary: "Evidence-grounded management decision support with human review." },
  { key: "ai-receptionist", label: "AI Receptionist", group: "AI Assistants", summary: "Front-desk assistance using approved booking and communication tools." },
  { key: "ai-retention", label: "AI Retention Manager", group: "AI Assistants", summary: "Retention signals, next-action recommendations and audience support." },
  { key: "ai-stylist-copilot", label: "AI Stylist Copilot", group: "AI Assistants", summary: "Professional appointment and consultation decision support for salon tenants." },
  { key: "clinical-records", label: "Clinical Records", group: "Specialist", summary: "Regulated clinical record capability for supported specialist tenants." },
]);

export const AIIBP_NEW_COMMERCIAL_MODULE_KEYS = Object.freeze(
  AIIBP_COMMERCIAL_MODULES.filter(({ newCommercial }) => newCommercial).map(({ key }) => key)
);

export function aiibpCommercialModule(key) {
  return AIIBP_COMMERCIAL_MODULES.find((module) => module.key === key) || null;
}
