/*
 * Lightweight management navigation registry.
 *
 * Keep route/label/permission/feature metadata here so MainLayout can
 * determine whether a route uses the management shell without importing
 * the rendered navigation component or the Lucide icon catalogue.
 */

const RAW_MANAGEMENT_SECTIONS = [
  { id: "operations", label: "Salon operations", links: [
    ["/dashboard", "Dashboard", "Performance overview", "Gauge", false, "dashboard:view"], ["/appointments", "Appointments", "Bookings and schedules", "CalendarDays", false, "appointment:read"], ["/staff/self-service", "My availability", "Availability and leave requests", "CalendarOff", false, "schedule:own:read"], ["/team-availability", "Team availability", "Working hours and time off", "UsersRound", false, "employee:read"], ["/customers", "Customers", "Profiles and activity", "ContactRound", false, "customer:read"], ["/admin/employees", "Employees", "Roles, booking and visibility", "UsersRound", false, "employee:read"], ["/admin/staff-roles", "Staff roles", "Custom roles and permissions", "UsersRound", false, "staff-role:read"], ["/staff/profile", "My public profile", "Photo, bio and specialties", "ContactRound", false, "profile:own:read"], ["/customer-segments", "Customer segments", "Audience groups", "UsersRound", false, "customer:read"], ["/retention-actions", "Retention actions", "Re-engagement work", "HeartHandshake", false, "customer:read"], ["/manage/services", "Salon services", "Services and pricing", "Scissors", false, "service:read"], ["/manage/products", "Products", "Retail catalogue and publishing", "Package", false, "product:read"], ["/data-imports", "Data imports", "Customers and products", "Upload", false, "data-import:manage"], 
  ]},
  { id: "communications", label: "Communications", links: [
    ["/communications", "Communications", "Contact history", "Mail", false, "communications:read", "communications"], ["/communication-templates", "Message templates", "Reusable content", "MessageSquareText", false, "communications:read", "communications"], ["/communication-campaigns", "Campaign composer", "Create campaigns", "Megaphone", false, "communications:read", "communications"], ["/scheduled-communications", "Scheduled messages", "Future delivery", "CalendarClock", false, "communications:read", "communications"], ["/message-delivery", "Message delivery", "Monitor and retry", "Send", false, "communications:read", "communications"],
  ]},
  { id: "booking-planning", label: "Booking and planning", links: [
    ["/calendar", "Calendar", "Daily and weekly schedule", "CalendarDays", false, "appointment:read"],
    ["/waitlist", "Waitlist", "Customers waiting for space", "ClipboardList", false, "appointment:read"],
    ["/booking-demand", "Booking demand", "Demand and capacity signals", "BarChart3", false, "appointment:read"],
    ["/booking-loss", "Booking loss", "Lost booking opportunities", "BadgePoundSterling", false, "appointment:read"],
    ["/smart-appointments", "Smart appointments", "AI-assisted appointment planning", "Sparkles", false, "ai:use", "ai-tools"],
    ["/capacity-planning", "Capacity planning", "Staff and chair capacity", "CalendarClock", false, "ai:use", "ai-tools"],
    ["/dynamic-pricing", "Dynamic pricing", "Pricing opportunities", "BadgePoundSterling", false, "ai:use", "ai-tools"],
  ]},
  { id: "marketing-growth", label: "Marketing and growth", links: [
    ["/customer-follow-ups", "Customer follow-ups", "Follow-up opportunities", "ContactRound", false, "customer:read"],
    ["/customer-value", "Customer value", "Customer value analysis", "BadgePoundSterling", false, "customer:read"],
    ["/retention-predictions", "Retention predictions", "Customers at risk", "HeartHandshake", false, "customer:read"],
    ["/rebooking-opportunities", "Rebooking opportunities", "Customers ready to rebook", "CalendarClock", false, "customer:read"],
    ["/rebooking-campaigns", "Rebooking campaigns", "Targeted rebooking activity", "Megaphone", false, "communications:read", "communications"],
    ["/marketing-attribution", "Marketing attribution", "Campaign and channel impact", "BarChart3", false, "ai:use", "ai-tools"],
  ]},
  { id: "performance", label: "Performance and reporting", links: [
    ["/revenue-forecast", "Revenue forecast", "Revenue outlook", "BadgePoundSterling", false, "reports:read"],
    ["/reports", "Reports", "Business reporting centre", "FileText", false, "reports:read"],
    ["/daily-close", "Daily close", "End-of-day controls", "ClipboardList", false, "reports:read"],
    ["/staff-rota", "Staff rota", "Team rota planning", "CalendarDays", false, "employee:read"],
    ["/staff-performance", "Staff performance", "Team performance", "BarChart3", false, "reports:read"],
    ["/service-performance", "Service performance", "Service results", "Scissors", false, "reports:read"],
    ["/feedback-analytics", "Feedback analytics", "Customer feedback trends", "BarChart3", false, "ai:use", "ai-tools"],
    ["/executive-command-centre", "Executive command centre", "Business-wide overview", "Gauge", false, "ai:use", "ai-tools"],
    ["/data-export-audit", "Data export audit", "Export activity and governance", "FileText", false, "reports:read"],
  ]},
  { id: "inventory", label: "Inventory and purchasing", links: [
    ["/manage/inventory", "Inventory", "Stock levels and adjustments", "Package", false, "inventory:read"],
    ["/manage/orders", "Order management", "Customer orders and fulfilment", "ClipboardList", false, "product:read"],
    ["/suppliers", "Suppliers", "Accounts and terms", "Building2", false, "inventory:read", "inventory-purchasing"],
    ["/purchase-orders", "Purchase orders", "Approve and receive", "ClipboardList", false, "inventory:read", "inventory-purchasing"],
    ["/reorder-recommendations", "Reorder recommendations", "Low-stock needs", "PackagePlus", false, "inventory:read", "inventory-purchasing"],
    ["/inventory-forecasting", "Inventory forecasting", "Stock demand forecasting", "BarChart3", false, "inventory:read", "inventory-purchasing"],
  ]},
  { id: "ai", label: "SalonAI tools", links: [
    ["/ai/haircare", "Haircare AI", "Recommendations", "Sparkles", false, "ai:use", "ai-tools"], ["/ai/customer-summaries", "Customer AI summaries", "History summaries", "FileText", false, "ai:use", "ai-tools"], ["/ai/customer-segmentation", "AI segmentation", "Behaviour analysis", "UsersRound", false, "ai:use", "ai-tools"], ["/ai/demand-forecasting", "Demand forecasting", "Bookings and capacity", "BarChart3", false, "ai:use", "ai-tools"], ["/ai/marketing-insights", "Marketing insights", "Campaign analysis", "Megaphone", false, "ai:use", "ai-tools"], ["/ai/no-show-predictions", "No-show prediction", "Booking risk", "CalendarClock", false, "ai:use", "ai-tools"], ["/ai/sales-forecasting", "Sales forecasting", "Revenue outlook", "BadgePoundSterling", false, "ai:use", "ai-tools"], ["/management-copilot", "Management copilot", "Prioritised actions", "Sparkles", false, "ai:use", "ai-tools"],
  ]},
  { id: "administration", label: "Administration", links: [
    ["/admin", "Admin overview", "Administrator control centre", "Gauge", true, "dashboard:view"],
    ["/admin/system", "On/Off Ideas", "Administrator feature controls", "ToggleLeft", false, "feature-control:read"],
  ]},
  { id: "premium", label: "Premium features", links: [
    ["/customer-experience-management", "Experience desk", "Reviews and requests", "ClipboardList", false, "customer:read"],
    ["/loyalty", "Loyalty programme", "Points and tiers", "Award", false, "loyalty:manage", "loyalty"], ["/gift-cards", "Gift cards", "Issue and redeem", "Gift", false, "gift-card:manage", "wallet"], ["/referrals", "Referral system", "Rewards and tracking", "Share2", false, "referral:manage", "referrals"], ["/notification-centre", "Notification centre", "Delivery status", "BellRing", false, "notification:manage", "notifications"], ["/push-notifications", "Push notifications", "Browser delivery", "BellRing", false, "push:manage", "notifications"], ["/email-campaigns", "Email campaigns", "Targeted emails", "Mail", false, "email-campaign:manage", "communications"], ["/sms-reminders", "SMS reminders", "Reminder rules", "MessageSquareText", false, "sms-reminder:manage", "communications"], ["/whatsapp-booking", "WhatsApp booking", "Conversations", "MessageCircle", false, "whatsapp:manage", "whatsapp-booking"], ["/retention-automation", "Retention automation", "Customer journeys", "Workflow", false, "retention-automation:manage", "retention-automation"], ["/premium-analytics", "Premium analytics", "Feature performance", "BarChart3", false, "premium-analytics:read", "premium-analytics"],
  ]},
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
    ]) => ({
      to,
      label,
      description,
      icon,
      adminOnly:
        Boolean(adminOnly),
      permission:
        permission || "",
      featureId:
        featureId || "",
    })
  ),
}));

export const MANAGEMENT_SECTIONS =
  RAW_MANAGEMENT_SECTIONS;

export const MANAGEMENT_LINKS =
  MANAGEMENT_SECTIONS.flatMap(
    (section) =>
      section.links
  );

export const MANAGEMENT_ROUTE_PATHS =
  Object.freeze(
    MANAGEMENT_LINKS.map(
      (link) =>
        link.to
    )
  );
