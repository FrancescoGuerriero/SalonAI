/*
 * Canonical management navigation registry.
 *
 * Route/label/permission/feature/presentation metadata lives here so the
 * management shell, route detection and tests consume one source of truth.
 * Presentation metadata is UX-only: it must never be used as an authority
 * check. Server-side RBAC and feature controls remain authoritative.
 */

export const MANAGEMENT_PRESENTATION_MODES = Object.freeze({
  SIMPLE: "simple",
  ADVANCED: "advanced",
});

const SIMPLE = MANAGEMENT_PRESENTATION_MODES.SIMPLE;
const ADVANCED = MANAGEMENT_PRESENTATION_MODES.ADVANCED;

/*
 * Sections are deliberately phrased as user tasks rather than database or
 * service boundaries. Advanced links remain in the same canonical registry;
 * Advanced mode only changes which already-authorised links are presented.
 *
 * Link tuple:
 * [to, label, description, icon, adminOnly, permission, featureId, presentation]
 */
const RAW_MANAGEMENT_SECTIONS = [
  {
    id: "run-salon",
    label: "Run the salon",
    links: [
      ["/dashboard", "Dashboard", "See today's business at a glance", "Gauge", false, "dashboard:view", "", SIMPLE],
      ["/appointments", "Appointments", "Manage bookings and schedules", "CalendarDays", false, "appointment:read", "", SIMPLE],
      ["/calendar", "Calendar", "Work from the daily and weekly schedule", "CalendarDays", false, "appointment:read", "", SIMPLE],
      ["/waitlist", "Waitlist", "Fill availability from waiting customers", "ClipboardList", false, "appointment:read", "", SIMPLE],
      ["/daily-close", "Daily close", "Complete end-of-day controls", "ClipboardList", false, "reports:read", "", SIMPLE],
      ["/booking-demand", "Booking demand", "Review demand and capacity signals", "BarChart3", false, "appointment:read", "", ADVANCED],
      ["/booking-loss", "Booking loss", "Review lost booking opportunities", "BadgePoundSterling", false, "appointment:read", "", ADVANCED],
      ["/smart-appointments", "Smart appointments", "Use AI-assisted appointment planning", "Sparkles", false, "ai:use", "ai-tools", ADVANCED],
      ["/capacity-planning", "Capacity planning", "Analyse staff and chair capacity", "CalendarClock", false, "ai:use", "ai-tools", ADVANCED],
      ["/dynamic-pricing", "Dynamic pricing", "Review pricing opportunities", "BadgePoundSterling", false, "ai:use", "ai-tools", ADVANCED],
    ],
  },
  {
    id: "customers",
    label: "Serve and retain customers",
    links: [
      ["/customers", "Customers", "Find profiles, history and activity", "ContactRound", false, "customer:read", "", SIMPLE],
      ["/customer-follow-ups", "Customer follow-ups", "Act on follow-up opportunities", "ContactRound", false, "customer:read", "", SIMPLE],
      ["/retention-actions", "Retention actions", "Manage re-engagement work", "HeartHandshake", false, "customer:read", "", SIMPLE],
      ["/customer-segments", "Customer segments", "Build and review audience groups", "UsersRound", false, "customer:read", "", ADVANCED],
      ["/customer-value", "Customer value", "Analyse customer value", "BadgePoundSterling", false, "customer:read", "", ADVANCED],
      ["/retention-predictions", "Retention predictions", "Identify customers at risk", "HeartHandshake", false, "customer:read", "", ADVANCED],
      ["/rebooking-opportunities", "Rebooking opportunities", "Find customers ready to rebook", "CalendarClock", false, "customer:read", "", ADVANCED],
      ["/customer-experience-management", "Experience desk", "Manage reviews and customer requests", "ClipboardList", false, "customer:read", "", ADVANCED],
      ["/loyalty", "Loyalty programme", "Manage points and tiers", "Award", false, "loyalty:manage", "loyalty", ADVANCED],
      ["/gift-cards", "Gift cards", "Issue and redeem gift cards", "Gift", false, "gift-card:manage", "wallet", ADVANCED],
      ["/referrals", "Referral system", "Manage rewards and referral tracking", "Share2", false, "referral:manage", "referrals", ADVANCED],
    ],
  },
  {
    id: "team",
    label: "Manage the team",
    links: [
      ["/staff/self-service", "My availability", "Manage your availability and leave requests", "CalendarOff", false, "schedule:own:read", "", SIMPLE],
      ["/team-availability", "Team availability", "Review working hours and time off", "UsersRound", false, "employee:read", "", SIMPLE],
      ["/admin/employees", "Employees", "Manage staff, booking and visibility", "UsersRound", false, "employee:read", "", SIMPLE],
      ["/staff/profile", "My public profile", "Manage photo, bio and specialties", "ContactRound", false, "profile:own:read", "", SIMPLE],
      ["/staff-rota", "Staff rota", "Plan the team rota", "CalendarDays", false, "employee:read", "", SIMPLE],
      ["/admin/staff-roles", "Staff roles", "Configure roles and delegated permissions", "UsersRound", false, "staff-role:read", "", ADVANCED],
      ["/staff-performance", "Staff performance", "Analyse team performance", "BarChart3", false, "reports:read", "", ADVANCED],
    ],
  },
  {
    id: "catalogue-stock",
    label: "Manage services, products and stock",
    links: [
      ["/manage/services", "Salon services", "Manage services and pricing", "Scissors", false, "service:read", "", SIMPLE],
      ["/manage/service-packages", "Service packages", "Create bundles and manage package credits", "PackagePlus", false, "service:read", "", SIMPLE],
      ["/manage/products", "Products", "Manage the retail catalogue and publishing", "Package", false, "product:read", "", SIMPLE],
      ["/manage/inventory", "Inventory", "Review stock levels and adjustments", "Package", false, "inventory:read", "", SIMPLE],
      ["/manage/orders", "Order management", "Manage customer orders and fulfilment", "ClipboardList", false, "product:read", "", SIMPLE],
      ["/suppliers", "Suppliers", "Manage supplier accounts and terms", "Building2", false, "inventory:read", "inventory-purchasing", SIMPLE],
      ["/purchase-orders", "Purchase orders", "Approve and receive purchasing", "ClipboardList", false, "inventory:read", "inventory-purchasing", SIMPLE],
      ["/reorder-recommendations", "Reorder recommendations", "Review low-stock needs", "PackagePlus", false, "inventory:read", "inventory-purchasing", ADVANCED],
      ["/inventory-forecasting", "Inventory forecasting", "Forecast stock demand", "BarChart3", false, "inventory:read", "inventory-purchasing", ADVANCED],
      ["/service-performance", "Service performance", "Analyse service results", "Scissors", false, "reports:read", "", ADVANCED],
      ["/data-imports", "Data imports", "Import customer and product data", "Upload", false, "data-import:manage", "", ADVANCED],
    ],
  },
  {
    id: "communications-growth",
    label: "Communicate and grow",
    links: [
      ["/communications", "Communications", "Review customer contact history", "Mail", false, "communications:read", "communications", SIMPLE],
      ["/communication-templates", "Message templates", "Manage reusable message content", "MessageSquareText", false, "communications:read", "communications", SIMPLE],
      ["/scheduled-communications", "Scheduled messages", "Review future message delivery", "CalendarClock", false, "communications:read", "communications", SIMPLE],
      ["/communication-campaigns", "Campaign composer", "Create targeted campaigns", "Megaphone", false, "communications:read", "communications", ADVANCED],
      ["/message-delivery", "Message delivery", "Monitor delivery and retry failures", "Send", false, "communications:read", "communications", ADVANCED],
      ["/rebooking-campaigns", "Rebooking campaigns", "Run targeted rebooking activity", "Megaphone", false, "communications:read", "communications", ADVANCED],
      ["/marketing-attribution", "Marketing attribution", "Analyse campaign and channel impact", "BarChart3", false, "ai:use", "ai-tools", ADVANCED],
      ["/notification-centre", "Notification centre", "Review notification delivery status", "BellRing", false, "notification:manage", "notifications", ADVANCED],
      ["/push-notifications", "Push notifications", "Manage browser delivery", "BellRing", false, "push:manage", "notifications", ADVANCED],
      ["/email-campaigns", "Email campaigns", "Manage targeted email campaigns", "Mail", false, "email-campaign:manage", "communications", ADVANCED],
      ["/sms-reminders", "SMS reminders", "Configure reminder rules", "MessageSquareText", false, "sms-reminder:manage", "communications", ADVANCED],
      ["/whatsapp-booking", "WhatsApp booking", "Manage booking conversations", "MessageCircle", false, "whatsapp:manage", "whatsapp-booking", ADVANCED],
      ["/retention-automation", "Retention automation", "Configure customer journeys", "Workflow", false, "retention-automation:manage", "retention-automation", ADVANCED],
    ],
  },
  {
    id: "performance",
    label: "Review performance and plan",
    links: [
      ["/reports", "Reports", "Open the business reporting centre", "FileText", false, "reports:read", "", SIMPLE],
      ["/revenue-forecast", "Revenue forecast", "Review the revenue outlook", "BadgePoundSterling", false, "reports:read", "", ADVANCED],
      ["/feedback-analytics", "Feedback analytics", "Analyse customer feedback trends", "BarChart3", false, "ai:use", "ai-tools", ADVANCED],
      ["/executive-command-centre", "Executive command centre", "Review a business-wide overview", "Gauge", false, "ai:use", "ai-tools", ADVANCED],
      ["/data-export-audit", "Data export audit", "Review export activity and governance", "FileText", false, "reports:read", "", ADVANCED],
      ["/premium-analytics", "Premium analytics", "Analyse premium feature performance", "BarChart3", false, "premium-analytics:read", "premium-analytics", ADVANCED],
    ],
  },
  {
    id: "ai-automation",
    label: "Use AI and automation",
    links: [
      ["/ai/haircare", "Haircare AI", "Create haircare recommendations", "Sparkles", false, "ai:use", "ai-tools", ADVANCED],
      ["/ai/customer-summaries", "Customer AI summaries", "Summarise customer history", "FileText", false, "ai:use", "ai-tools", ADVANCED],
      ["/ai/customer-segmentation", "AI segmentation", "Analyse customer behaviour", "UsersRound", false, "ai:use", "ai-tools", ADVANCED],
      ["/ai/demand-forecasting", "Demand forecasting", "Forecast bookings and capacity", "BarChart3", false, "ai:use", "ai-tools", ADVANCED],
      ["/ai/marketing-insights", "Marketing insights", "Analyse campaign performance", "Megaphone", false, "ai:use", "ai-tools", ADVANCED],
      ["/ai/no-show-predictions", "No-show prediction", "Review booking risk", "CalendarClock", false, "ai:use", "ai-tools", ADVANCED],
      ["/ai/sales-forecasting", "Sales forecasting", "Forecast the revenue outlook", "BadgePoundSterling", false, "ai:use", "ai-tools", ADVANCED],
      ["/management-copilot", "Management copilot", "Review prioritised management actions", "Sparkles", false, "ai:use", "ai-tools", ADVANCED],
    ],
  },
  {
    id: "administration",
    label: "Configure the business",
    links: [
      ["/admin", "Admin overview", "Open the administrator control centre", "Gauge", true, "dashboard:view", "", ADVANCED],
      ["/admin/privacy-requests", "Privacy requests", "Review and action customer privacy-rights requests", "ShieldCheck", false, "privacy-request:manage", "", ADVANCED],
      ["/admin/system", "On/Off Ideas", "Manage administrator feature controls", "ToggleLeft", false, "feature-control:read", "", ADVANCED],
    ],
  },
].map((section) => ({
  ...section,
  links: section.links.map(
    ([
      to,
      label,
      description,
      icon,
      adminOnly,
      permission,
      featureId,
      presentation,
    ]) => ({
      to,
      label,
      description,
      icon,
      adminOnly: Boolean(adminOnly),
      permission: permission || "",
      featureId: featureId || "",
      presentation:
        presentation === ADVANCED
          ? ADVANCED
          : SIMPLE,
    })
  ),
}));

export const MANAGEMENT_SECTIONS = RAW_MANAGEMENT_SECTIONS;

export const MANAGEMENT_LINKS = MANAGEMENT_SECTIONS.flatMap(
  (section) => section.links
);

export const MANAGEMENT_ROUTE_PATHS = Object.freeze(
  MANAGEMENT_LINKS.map((link) => link.to)
);

export function isAdvancedManagementLink(link) {
  return link?.presentation === MANAGEMENT_PRESENTATION_MODES.ADVANCED;
}

export function isManagementLinkVisibleForPresentation(
  link,
  presentationMode,
  hasSearchQuery = false
) {
  if (hasSearchQuery) {
    return true;
  }

  return (
    presentationMode === MANAGEMENT_PRESENTATION_MODES.ADVANCED ||
    !isAdvancedManagementLink(link)
  );
}
