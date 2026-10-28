export const AIIBP_MODULE_OPERATIONAL_SURFACES = Object.freeze([
  { key: "appointments", primaryRoute: "/appointments", surface: "management", salonOperational: true },
  { key: "staff", primaryRoute: "/admin/employees", surface: "management", salonOperational: true },
  { key: "services", primaryRoute: "/manage/services", surface: "management", salonOperational: true },
  { key: "commerce", primaryRoute: "/manage/orders", customerRoute: "/checkout", surface: "management", salonOperational: true },
  { key: "ecommerce-store", primaryRoute: "/manage/products", customerRoute: "/shop", surface: "management", salonOperational: true },
  { key: "memberships", primaryRoute: "/memberships", surface: "management", salonOperational: true },
  { key: "inventory", primaryRoute: "/manage/inventory", surface: "management", salonOperational: true },
  { key: "loyalty", primaryRoute: "/loyalty", surface: "management", salonOperational: true },
  { key: "communications", primaryRoute: "/communications", surface: "management", salonOperational: true },
  { key: "calendar", primaryRoute: "/calendar", accountRoute: "/account", surface: "management", salonOperational: true },
  { key: "integrations", primaryRoute: "/admin/system/connections", surface: "management", salonOperational: true },
  { key: "crm", primaryRoute: "/customers", surface: "management", salonOperational: true },
  { key: "customer-experience", primaryRoute: "/customer-experience-management", surface: "management", salonOperational: true },
  { key: "marketing", primaryRoute: "/marketing", surface: "management", salonOperational: true },
  { key: "seller-marketplace", primaryRoute: "/admin/system/connections", sellerRoute: "/marketing/data-connections?type=seller", surface: "management", salonOperational: true },
  { key: "analytics", primaryRoute: "/reports", surface: "management", salonOperational: true },
  { key: "business-planning", primaryRoute: "/revenue-forecast", supportingRoutes: ["/booking-demand", "/capacity-planning", "/executive-command-centre"], surface: "management", salonOperational: true },
  { key: "ai-decision-support", primaryRoute: "/management-copilot", surface: "management", salonOperational: true },
  { key: "ai-receptionist", primaryRoute: "/whatsapp-booking", customerSurface: "salon-chatbot", surface: "management", salonOperational: true },
  { key: "ai-retention", primaryRoute: "/retention-predictions", supportingRoutes: ["/retention-actions", "/retention-automation"], surface: "management", salonOperational: true },
  { key: "ai-stylist-copilot", primaryRoute: "/stylist-copilot", surface: "management", salonOperational: true },
  {
    key: "clinical-records",
    primaryRoute: null,
    surface: "vertical-restricted",
    salonOperational: false,
    supportedVerticals: ["plastic-surgery"],
    reason: "Clinical Records is an experimental regulated capability restricted to eligible Plastic Surgery AI tenants and must not be exposed in SalonAI.",
  },
]);

export const AIIBP_MODULE_OPERATIONAL_SURFACE_BY_KEY = Object.freeze(
  Object.fromEntries(
    AIIBP_MODULE_OPERATIONAL_SURFACES.map((surface) => [surface.key, surface])
  )
);

export function aiibpModuleOperationalSurface(key) {
  return AIIBP_MODULE_OPERATIONAL_SURFACE_BY_KEY[key] || null;
}
