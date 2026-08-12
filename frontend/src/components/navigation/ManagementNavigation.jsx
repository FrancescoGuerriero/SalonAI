import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Award, BadgePoundSterling, BarChart3, BellRing, Building2, CalendarClock, CalendarDays, ChevronDown, ClipboardList, ContactRound, FileText, Gauge, Gift, HeartHandshake, Mail, Megaphone, MessageCircle, MessageSquareText, PackagePlus, Scissors, Search, Send, Share2, Sparkles, Upload, UsersRound, Workflow } from "lucide-react";

import useAuth from "../../hooks/useAuth.js";
import { isAdminRole } from "../../utils/roles.js";

export const MANAGEMENT_SECTIONS = [
  { id: "operations", label: "Salon operations", links: [
    ["/dashboard", "Dashboard", "Performance overview", Gauge], ["/appointments", "Appointments", "Bookings and schedules", CalendarDays], ["/customers", "Customers", "Profiles and activity", ContactRound], ["/staff/profile", "My public profile", "Photo, bio and specialties", ContactRound], ["/customer-segments", "Customer segments", "Audience groups", UsersRound], ["/retention-actions", "Retention actions", "Re-engagement work", HeartHandshake], ["/manage/services", "Salon services", "Services and pricing", Scissors], ["/data-imports", "Data imports", "Customers and products", Upload, true],
  ]},
  { id: "communications", label: "Communications", links: [
    ["/communications", "Communications", "Contact history", Mail], ["/communication-templates", "Message templates", "Reusable content", MessageSquareText], ["/communication-campaigns", "Campaign composer", "Create campaigns", Megaphone], ["/scheduled-communications", "Scheduled messages", "Future delivery", CalendarClock], ["/message-delivery", "Message delivery", "Monitor and retry", Send],
  ]},
  { id: "inventory", label: "Inventory and purchasing", links: [
    ["/suppliers", "Suppliers", "Accounts and terms", Building2], ["/purchase-orders", "Purchase orders", "Approve and receive", ClipboardList], ["/reorder-recommendations", "Reorder recommendations", "Low-stock needs", PackagePlus],
  ]},
  { id: "ai", label: "SalonAI tools", links: [
    ["/ai/haircare", "Haircare AI", "Recommendations", Sparkles], ["/ai/customer-summaries", "Customer AI summaries", "History summaries", FileText], ["/ai/customer-segmentation", "AI segmentation", "Behaviour analysis", UsersRound], ["/ai/demand-forecasting", "Demand forecasting", "Bookings and capacity", BarChart3], ["/ai/marketing-insights", "Marketing insights", "Campaign analysis", Megaphone], ["/ai/no-show-predictions", "No-show prediction", "Booking risk", CalendarClock], ["/ai/sales-forecasting", "Sales forecasting", "Revenue outlook", BadgePoundSterling], ["/management-copilot", "Management copilot", "Prioritised actions", Sparkles],
  ]},
  { id: "premium", label: "Premium features", links: [
    ["/customer-experience-management", "Experience desk", "Reviews and requests", ClipboardList],
    ["/loyalty", "Loyalty programme", "Points and tiers", Award], ["/gift-cards", "Gift cards", "Issue and redeem", Gift], ["/referrals", "Referral system", "Rewards and tracking", Share2], ["/notification-centre", "Notification centre", "Delivery status", BellRing], ["/push-notifications", "Push notifications", "Browser delivery", BellRing], ["/email-campaigns", "Email campaigns", "Targeted emails", Mail], ["/sms-reminders", "SMS reminders", "Reminder rules", MessageSquareText], ["/whatsapp-booking", "WhatsApp booking", "Conversations", MessageCircle], ["/retention-automation", "Retention automation", "Customer journeys", Workflow], ["/premium-analytics", "Premium analytics", "Feature performance", BarChart3],
  ]},
].map((section) => ({ ...section, links: section.links.map(([to, label, description, icon, adminOnly]) => ({ to, label, description, icon, adminOnly: Boolean(adminOnly) })) }));

export const MANAGEMENT_LINKS = MANAGEMENT_SECTIONS.flatMap((section) => section.links);

export default function ManagementNavigation({ collapsed = false, onNavigate }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(new Set());
  const sections = useMemo(() => {
    const term = query.trim().toLowerCase();
    return MANAGEMENT_SECTIONS.map((section) => ({
      ...section,
      links: section.links.filter((link) =>
        (!link.adminOnly || isAdminRole(user?.role)) &&
        (!term || `${link.label} ${link.description}`.toLowerCase().includes(term))
      ),
    })).filter((section) => section.links.length);
  }, [query, user?.role]);

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
