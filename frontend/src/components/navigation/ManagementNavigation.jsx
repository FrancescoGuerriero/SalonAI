import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Award, BadgePoundSterling, BarChart3, BellRing, Building2, CalendarClock, CalendarDays, CalendarOff, ChevronDown, ClipboardList, ContactRound, FileText, Gauge, Gift, HeartHandshake, Mail, Megaphone, MessageCircle, MessageSquareText, Package, PackagePlus, Scissors, Search, Send, Share2, Sparkles, ToggleLeft, Upload, UsersRound, Workflow } from "lucide-react";

import useAuth from "../../hooks/useAuth.js";
import {
  hasFullManagementDashboard,
  isAdminRole,
  isSuperAdminRole,
} from "../../utils/roles.js";
import { hasPermission } from "../../utils/permissions.js";
import useFeatureControls from "../../hooks/useFeatureControls.js";

export const MANAGEMENT_SECTIONS = [
  { id: "operations", label: "Salon operations", links: [
    ["/dashboard", "Dashboard", "Performance overview", Gauge, false, "dashboard:view"], ["/appointments", "Appointments", "Bookings and schedules", CalendarDays, false, "appointment:read"], ["/staff/self-service", "My availability", "Availability and leave requests", CalendarOff, false, "schedule:own:read"], ["/customers", "Customers", "Profiles and activity", ContactRound, false, "customer:read"], ["/admin/employees", "Employees", "Roles, booking and visibility", UsersRound, false, "employee:read"], ["/admin/staff-roles", "Staff roles", "Custom roles and permissions", UsersRound, false, "staff-role:read"], ["/staff/profile", "My public profile", "Photo, bio and specialties", ContactRound], ["/customer-segments", "Customer segments", "Audience groups", UsersRound, false, "customer:read"], ["/retention-actions", "Retention actions", "Re-engagement work", HeartHandshake, false, "customer:read"], ["/manage/services", "Salon services", "Services and pricing", Scissors, false, "service:read"], ["/manage/products", "Products", "Retail catalogue and publishing", Package, false, "product:read"], ["/data-imports", "Data imports", "Customers and products", Upload, true], ["/admin/system", "On/Off Ideas", "Administrator feature controls", ToggleLeft, true],
  ]},
  { id: "communications", label: "Communications", links: [
    ["/communications", "Communications", "Contact history", Mail, false, "communications:read", "communications"], ["/communication-templates", "Message templates", "Reusable content", MessageSquareText, false, "communications:read", "communications"], ["/communication-campaigns", "Campaign composer", "Create campaigns", Megaphone, false, "communications:read", "communications"], ["/scheduled-communications", "Scheduled messages", "Future delivery", CalendarClock, false, "communications:read", "communications"], ["/message-delivery", "Message delivery", "Monitor and retry", Send, false, "communications:read", "communications"],
  ]},
  { id: "booking-planning", label: "Booking and planning", links: [
    ["/calendar", "Calendar", "Daily and weekly schedule", CalendarDays, false, "appointment:read"],
    ["/waitlist", "Waitlist", "Customers waiting for space", ClipboardList, false, "appointment:read"],
    ["/booking-demand", "Booking demand", "Demand and capacity signals", BarChart3, false, "appointment:read"],
    ["/booking-loss", "Booking loss", "Lost booking opportunities", BadgePoundSterling, false, "appointment:read"],
    ["/smart-appointments", "Smart appointments", "AI-assisted appointment planning", Sparkles, false, "ai:use", "ai-tools"],
    ["/capacity-planning", "Capacity planning", "Staff and chair capacity", CalendarClock, false, "ai:use", "ai-tools"],
    ["/dynamic-pricing", "Dynamic pricing", "Pricing opportunities", BadgePoundSterling, false, "ai:use", "ai-tools"],
  ]},
  { id: "marketing-growth", label: "Marketing and growth", links: [
    ["/customer-follow-ups", "Customer follow-ups", "Follow-up opportunities", ContactRound, false, "customer:read"],
    ["/customer-value", "Customer value", "Customer value analysis", BadgePoundSterling, false, "customer:read"],
    ["/retention-predictions", "Retention predictions", "Customers at risk", HeartHandshake, false, "customer:read"],
    ["/rebooking-opportunities", "Rebooking opportunities", "Customers ready to rebook", CalendarClock, false, "customer:read"],
    ["/rebooking-campaigns", "Rebooking campaigns", "Targeted rebooking activity", Megaphone, false, "communications:read", "communications"],
    ["/marketing-attribution", "Marketing attribution", "Campaign and channel impact", BarChart3, false, "ai:use", "ai-tools"],
  ]},
  { id: "performance", label: "Performance and reporting", links: [
    ["/revenue-forecast", "Revenue forecast", "Revenue outlook", BadgePoundSterling, false, "reports:read"],
    ["/reports", "Reports", "Business reporting centre", FileText, false, "reports:read"],
    ["/daily-close", "Daily close", "End-of-day controls", ClipboardList, false, "reports:read"],
    ["/staff-rota", "Staff rota", "Team rota planning", CalendarDays, false, "employee:read"],
    ["/staff-management", "Staff management", "Operational staff controls", UsersRound, false, "employee:read"],
    ["/staff-performance", "Staff performance", "Team performance", BarChart3, false, "reports:read"],
    ["/service-performance", "Service performance", "Service results", Scissors, false, "reports:read"],
    ["/feedback-analytics", "Feedback analytics", "Customer feedback trends", BarChart3, false, "ai:use", "ai-tools"],
    ["/executive-command-centre", "Executive command centre", "Business-wide overview", Gauge, false, "ai:use", "ai-tools"],
    ["/data-export-audit", "Data export audit", "Export activity and governance", FileText, false, "reports:read"],
  ]},
  { id: "inventory", label: "Inventory and purchasing", links: [
    ["/manage/inventory", "Inventory", "Stock levels and adjustments", Package, false, "inventory:read"],
    ["/manage/orders", "Order management", "Customer orders and fulfilment", ClipboardList, false, "product:read"],
    ["/suppliers", "Suppliers", "Accounts and terms", Building2, false, "inventory:read", "inventory-purchasing"],
    ["/purchase-orders", "Purchase orders", "Approve and receive", ClipboardList, false, "inventory:read", "inventory-purchasing"],
    ["/reorder-recommendations", "Reorder recommendations", "Low-stock needs", PackagePlus, false, "inventory:read", "inventory-purchasing"],
    ["/inventory-forecasting", "Inventory forecasting", "Stock demand forecasting", BarChart3, false, "inventory:read", "inventory-purchasing"],
  ]},
  { id: "ai", label: "SalonAI tools", links: [
    ["/ai/haircare", "Haircare AI", "Recommendations", Sparkles, false, "ai:use", "ai-tools"], ["/ai/customer-summaries", "Customer AI summaries", "History summaries", FileText, false, "ai:use", "ai-tools"], ["/ai/customer-segmentation", "AI segmentation", "Behaviour analysis", UsersRound, false, "ai:use", "ai-tools"], ["/ai/demand-forecasting", "Demand forecasting", "Bookings and capacity", BarChart3, false, "ai:use", "ai-tools"], ["/ai/marketing-insights", "Marketing insights", "Campaign analysis", Megaphone, false, "ai:use", "ai-tools"], ["/ai/no-show-predictions", "No-show prediction", "Booking risk", CalendarClock, false, "ai:use", "ai-tools"], ["/ai/sales-forecasting", "Sales forecasting", "Revenue outlook", BadgePoundSterling, false, "ai:use", "ai-tools"], ["/management-copilot", "Management copilot", "Prioritised actions", Sparkles, false, "ai:use", "ai-tools"],
  ]},
  { id: "administration", label: "Administration", links: [
    ["/admin", "Admin overview", "Administrator control centre", Gauge, true],
    ["/admin/services", "Admin services", "Legacy service administration", Scissors, true],
    ["/admin/stylists", "Admin stylists", "Legacy stylist administration", UsersRound, true],
    ["/admin/appointments", "Admin appointments", "Administrator appointment controls", CalendarDays, true],
    ["/admin/customers", "Admin customers", "Administrator customer controls", ContactRound, true],
    ["/admin/staff-accounts", "Staff accounts", "Staff account administration", UsersRound, false, "employee:read"],
  ]},
  { id: "premium", label: "Premium features", links: [
    ["/customer-experience-management", "Experience desk", "Reviews and requests", ClipboardList, false, "customer:read"],
    ["/loyalty", "Loyalty programme", "Points and tiers", Award, false, "customer:read", "loyalty"], ["/gift-cards", "Gift cards", "Issue and redeem", Gift, false, "customer:read", "wallet"], ["/referrals", "Referral system", "Rewards and tracking", Share2, false, "customer:read", "referrals"], ["/notification-centre", "Notification centre", "Delivery status", BellRing, false, "communications:read", "notifications"], ["/push-notifications", "Push notifications", "Browser delivery", BellRing, false, "communications:read", "notifications"], ["/email-campaigns", "Email campaigns", "Targeted emails", Mail, false, "communications:read", "communications"], ["/sms-reminders", "SMS reminders", "Reminder rules", MessageSquareText, false, "communications:read", "communications"], ["/whatsapp-booking", "WhatsApp booking", "Conversations", MessageCircle, false, "communications:read", "whatsapp-booking"], ["/retention-automation", "Retention automation", "Customer journeys", Workflow, false, "communications:read", "retention-automation"], ["/premium-analytics", "Premium analytics", "Feature performance", BarChart3, false, "reports:read", "premium-analytics"],
  ]},
].map((section) => ({ ...section, links: section.links.map(([to, label, description, icon, adminOnly, permission, featureId]) => ({ to, label, description, icon, adminOnly: Boolean(adminOnly), permission: permission || "", featureId: featureId || "" })) }));

export const MANAGEMENT_LINKS = MANAGEMENT_SECTIONS.flatMap((section) => section.links);

export default function ManagementNavigation({ collapsed = false, onNavigate }) {
  const { user } = useAuth();
  const { isFeatureEnabled } = useFeatureControls();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(new Set());
  const sections = useMemo(() => {
    const term = query.trim().toLowerCase();
    const canReadAllProfiles =
      hasPermission(
        user,
        "profile:all:read"
      );

    const canReadOwnProfile =
      hasPermission(
        user,
        "profile:own:read"
      );

    const fullDashboard =
      hasFullManagementDashboard(
        user?.role
      );

    return MANAGEMENT_SECTIONS.map((section) => ({
      ...section,
      links: section.links
        .map((link) =>
          link.to === "/staff/profile" &&
          canReadAllProfiles
            ? {
                ...link,
                label:
                  "Staff profiles",
                description:
                  "Team photos, bios and specialties",
              }
            : link
        )
        .filter((link) =>
          (!link.adminOnly || isAdminRole(user?.role)) &&
          (link.to !== "/staff/profile" ||
            canReadOwnProfile ||
            canReadAllProfiles) &&
          (!link.permission || fullDashboard || hasPermission(user, link.permission)) &&
          (!link.featureId ||
            isSuperAdminRole(
              user?.role
            ) ||
            isFeatureEnabled(
              link.featureId
            )) &&
          (!term || `${link.label} ${link.description}`.toLowerCase().includes(term))
        ),
    })).filter((section) => section.links.length);
  }, [
    isFeatureEnabled,
    query,
    user?.permissions,
    user?.rolePermissions,
    user?.role,
  ]);

  function toggle(id) {
    setClosed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  return (
    <div className="management-navigation">
      {!collapsed && <label className="management-search"><Search size={16} /><span className="sr-only">Search management navigation</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a workspace…" /></label>}
      <div className="management-sections">
        {sections.map((section) => {
          const isClosed = !query && closed.has(section.id);
          return <section key={section.id} className="management-section">
            {!collapsed && <button type="button" className="management-section-toggle" onClick={() => toggle(section.id)} aria-expanded={!isClosed}><span>{section.label}</span><ChevronDown size={15} className={isClosed ? "is-closed" : ""} /></button>}
            {!isClosed && <div className="management-link-list">{section.links.map(({ to, label, description, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} title={collapsed ? label : undefined} className={({ isActive }) => `management-link${isActive ? " management-link-active" : ""}`}><span className="management-link-icon"><Icon size={18} /></span>{!collapsed && <span className="management-link-copy"><strong>{label}</strong><small>{description}</small></span>}</NavLink>)}</div>}
          </section>;
        })}
        {!sections.length && !collapsed && <div className="app-empty-state compact"><Search size={22} /><strong>No tools found</strong><p>Try another search term.</p></div>}
      </div>
    </div>
  );
}
