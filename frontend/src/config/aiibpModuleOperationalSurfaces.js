export const AIIBP_MODULE_OPERATIONAL_SURFACES = Object.freeze([
  {
    key: "appointments",
    primaryRoute: "/appointments",
    entitlementRoutes: ["/appointments", "/waitlist", "/booking-loss", "/smart-appointments"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "staff",
    primaryRoute: "/admin/employees",
    entitlementRoutes: ["/staff/self-service", "/team-availability", "/admin/employees", "/staff/profile", "/staff-rota", "/admin/staff-roles", "/staff-performance"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "services",
    primaryRoute: "/manage/services",
    entitlementRoutes: ["/manage/services", "/manage/service-packages", "/service-performance"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "commerce",
    primaryRoute: "/manage/orders",
    customerRoute: "/checkout",
    entitlementRoutes: ["/manage/orders", "/gift-cards"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "ecommerce-store",
    primaryRoute: "/manage/products",
    customerRoute: "/shop",
    entitlementRoutes: ["/manage/products"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "memberships",
    primaryRoute: "/memberships",
    entitlementRoutes: ["/memberships"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "inventory",
    primaryRoute: "/manage/inventory",
    entitlementRoutes: ["/manage/inventory", "/suppliers", "/purchase-orders", "/reorder-recommendations", "/inventory-forecasting"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "loyalty",
    primaryRoute: "/loyalty",
    entitlementRoutes: ["/loyalty"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "communications",
    primaryRoute: "/communications",
    entitlementRoutes: ["/communications", "/communication-templates", "/scheduled-communications", "/communication-campaigns", "/message-delivery", "/rebooking-campaigns", "/notification-centre", "/push-notifications", "/email-campaigns", "/sms-reminders"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "calendar",
    primaryRoute: "/calendar",
    accountRoute: "/account",
    entitlementRoutes: ["/calendar"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "integrations",
    primaryRoute: "/admin/system/connections",
    entitlementRoutes: [],
    surface: "management",
    salonOperational: true,
    reason: "Integration Hub is commercially allocatable, while its shared system administration route remains a platform capability surface used by multiple modules.",
  },
  {
    key: "crm",
    primaryRoute: "/customers",
    entitlementRoutes: ["/customers", "/customer-follow-ups", "/customer-segments", "/customer-value", "/rebooking-opportunities"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "customer-experience",
    primaryRoute: "/customer-experience-management",
    entitlementRoutes: ["/customer-experience-management", "/feedback-analytics"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "marketing",
    primaryRoute: "/marketing",
    entitlementRoutes: ["/marketing", "/marketing-attribution"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "seller-marketplace",
    primaryRoute: "/marketplaces",
    connectionRoute: "/admin/system/connections",
    sellerRoute: "/marketing/data-connections?type=seller",
    entitlementRoutes: ["/marketplaces", "/marketing/data-connections"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "analytics",
    primaryRoute: "/reports",
    entitlementRoutes: ["/reports", "/premium-analytics"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "business-planning",
    primaryRoute: "/revenue-forecast",
    supportingRoutes: ["/booking-demand", "/capacity-planning", "/executive-command-centre"],
    entitlementRoutes: ["/booking-demand", "/capacity-planning", "/revenue-forecast", "/executive-command-centre"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "ai-decision-support",
    primaryRoute: "/management-copilot",
    entitlementRoutes: ["/management-copilot"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "ai-receptionist",
    primaryRoute: "/whatsapp-booking",
    customerSurface: "salon-chatbot",
    entitlementRoutes: ["/ai-receptionist", "/whatsapp-booking"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "ai-retention",
    primaryRoute: "/retention-predictions",
    supportingRoutes: ["/retention-actions", "/retention-automation"],
    entitlementRoutes: ["/retention-actions", "/retention-predictions", "/retention-automation"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "ai-stylist-copilot",
    primaryRoute: "/stylist-copilot",
    entitlementRoutes: ["/stylist-copilot"],
    surface: "management",
    salonOperational: true,
  },
  {
    key: "clinical-records",
    primaryRoute: null,
    entitlementRoutes: [],
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

export function aiibpCommercialModuleKeyForRoute(route) {
  const pathname = String(route || "").split("?")[0];
  let bestMatch = null;

  for (const surface of AIIBP_MODULE_OPERATIONAL_SURFACES) {
    if (!surface.salonOperational) continue;

    const routes = Array.isArray(surface.entitlementRoutes)
      ? surface.entitlementRoutes
      : [];

    for (const candidate of routes) {
      if (
        pathname !== candidate &&
        !pathname.startsWith(`${candidate}/`)
      ) {
        continue;
      }

      if (!bestMatch || candidate.length > bestMatch.route.length) {
        bestMatch = {
          key: surface.key,
          route: candidate,
        };
      }
    }
  }

  return bestMatch?.key || "";
}
