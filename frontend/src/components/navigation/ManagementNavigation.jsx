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

import {
  MANAGEMENT_SECTIONS,
} from "./managementNavigationConfig.js";

const MANAGEMENT_SECTION_PREVIEW = 5;

const MANAGEMENT_ICONS =
  Object.freeze({
    Award,
    BadgePoundSterling,
    BarChart3,
    BellRing,
    Building2,
    CalendarClock,
    CalendarDays,
    CalendarOff,
    ClipboardList,
    ContactRound,
    FileText,
    Gauge,
    Gift,
    HeartHandshake,
    Mail,
    Megaphone,
    MessageCircle,
    MessageSquareText,
    Package,
    PackagePlus,
    Scissors,
    Send,
    Share2,
    Sparkles,
    ToggleLeft,
    Upload,
    UsersRound,
    Workflow,
  });

export default function ManagementNavigation({ collapsed = false, onNavigate }) {
  const { user } = useAuth();
  const { isFeatureEnabled } = useFeatureControls();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
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
        .map((link) => ({
          ...link,
          icon:
            MANAGEMENT_ICONS[
              link.icon
            ] || Sparkles,
          featureDisabled:
            Boolean(link.featureId) &&
            !isSuperAdminRole(
              user?.role
            ) &&
            !isFeatureEnabled(
              link.featureId
            ),
        }))
        .filter((link) =>
          (!link.adminOnly || isAdminRole(user?.role)) &&
          (link.to !== "/staff/profile" ||
            canReadOwnProfile ||
            canReadAllProfiles) &&
          (!link.permission || fullDashboard || hasPermission(user, link.permission)) &&
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
    setClosed((current) => {
      const next = new Set(current);
      next.has(id)
        ? next.delete(id)
        : next.add(id);
      return next;
    });
  }

  function toggleExpanded(id) {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(id)
        ? next.delete(id)
        : next.add(id);
      return next;
    });
  }

  return (
    <div className="management-navigation">
      {!collapsed && <label className="management-search"><Search size={16} /><span className="sr-only">Search management navigation</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a workspace…" /></label>}
      <div className="management-sections">
        {sections.map((section) => {
          const isClosed = !query && closed.has(section.id);
          const showAll =
            Boolean(query) ||
            collapsed ||
            expanded.has(section.id);
          const visibleLinks =
            showAll
              ? section.links
              : section.links.slice(
                  0,
                  MANAGEMENT_SECTION_PREVIEW
                );
          const hiddenCount =
            Math.max(
              0,
              section.links.length -
                visibleLinks.length
            );

          return <section key={section.id} className="management-section">
            {!collapsed && <button type="button" className="management-section-toggle" onClick={() => toggle(section.id)} aria-expanded={!isClosed}><span>{section.label}</span><ChevronDown size={15} className={isClosed ? "is-closed" : ""} /></button>}
            {!isClosed && (
              <>
              <div className="management-link-list">
                {visibleLinks.map(
                  ({
                    to,
                    label,
                    description,
                    icon: Icon,
                    featureDisabled,
                  }) => (
                    <NavLink
                      key={to}
                      to={to}
                      aria-disabled={
                        featureDisabled
                          ? "true"
                          : undefined
                      }
                      onClick={(event) => {
                        if (featureDisabled) {
                          event.preventDefault();
                          return;
                        }

                        onNavigate?.();
                      }}
                      title={
                        collapsed
                          ? label
                          : featureDisabled
                            ? `${label} — currently off`
                            : undefined
                      }
                      style={
                        featureDisabled
                          ? {
                              cursor: "not-allowed",
                              opacity: 0.55,
                            }
                          : undefined
                      }
                      className={({ isActive }) =>
                        `management-link${isActive ? " management-link-active" : ""}${featureDisabled ? " management-link-disabled" : ""}`
                      }
                    >
                      <span className="management-link-icon">
                        <Icon size={18} />
                      </span>
                      {!collapsed && (
                        <span className="management-link-copy">
                          <strong>{label}</strong>
                          <small>
                            {featureDisabled
                              ? "Currently off"
                              : description}
                          </small>
                        </span>
                      )}
                    </NavLink>
                  )
                )}
              </div>
              {!query &&
                !collapsed &&
                section.links.length >
                  MANAGEMENT_SECTION_PREVIEW && (
                  <button
                    type="button"
                    className="management-section-more"
                    onClick={() =>
                      toggleExpanded(
                        section.id
                      )
                    }
                    aria-expanded={
                      showAll
                    }
                  >
                    {showAll
                      ? "Show fewer tools"
                      : `Show ${hiddenCount} more tools`}
                  </button>
                )}
              </>
            )}
          </section>;
        })}
        {!sections.length && !collapsed && <div className="app-empty-state compact"><Search size={22} /><strong>No tools found</strong><p>Try another search term.</p></div>}
      </div>
    </div>
  );
}
