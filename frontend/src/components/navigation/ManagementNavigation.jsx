import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Award, BadgePoundSterling, BarChart3, BellRing, Building2, CalendarClock, CalendarDays, CalendarOff, ChevronDown, ClipboardList, ContactRound, FileText, Gauge, Gift, HeartHandshake, Mail, Megaphone, MessageCircle, MessageSquareText, Package, PackagePlus, Scissors, Search, Send, Share2, ShieldCheck, Sparkles, ToggleLeft, Upload, UsersRound, Workflow } from "lucide-react";

import useAuth from "../../hooks/useAuth.js";
import {
  hasFullManagementDashboard,
  isAdminRole,
  isSuperAdminRole,
} from "../../utils/roles.js";
import { hasPermission } from "../../utils/permissions.js";
import useFeatureControls from "../../hooks/useFeatureControls.js";

import {
  isAdvancedManagementLink,
  isManagementLinkVisibleForPresentation,
  MANAGEMENT_PRESENTATION_MODES,
  MANAGEMENT_SECTIONS,
} from "./managementNavigationConfig.js";
import "./ManagementNavigation.css";

const MANAGEMENT_SECTION_PREVIEW = 5;
const MANAGEMENT_PRESENTATION_STORAGE_KEY =
  "salonai.managementNavigation.presentation.v1";

const MANAGEMENT_ICONS = Object.freeze({
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
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  Upload,
  UsersRound,
  Workflow,
});

function readPresentationMode() {
  if (typeof window === "undefined") {
    return MANAGEMENT_PRESENTATION_MODES.SIMPLE;
  }

  try {
    return window.localStorage.getItem(
      MANAGEMENT_PRESENTATION_STORAGE_KEY
    ) === MANAGEMENT_PRESENTATION_MODES.ADVANCED
      ? MANAGEMENT_PRESENTATION_MODES.ADVANCED
      : MANAGEMENT_PRESENTATION_MODES.SIMPLE;
  } catch {
    return MANAGEMENT_PRESENTATION_MODES.SIMPLE;
  }
}

export default function ManagementNavigation({ collapsed = false, onNavigate }) {
  const { user } = useAuth();
  const { isFeatureEnabled } = useFeatureControls();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [presentationMode, setPresentationMode] = useState(
    readPresentationMode
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        MANAGEMENT_PRESENTATION_STORAGE_KEY,
        presentationMode
      );
    } catch {
      // Presentation preference is optional. Navigation must remain usable
      // when storage is unavailable (private mode, policies, quota, etc.).
    }
  }, [presentationMode]);

  const authorisedSections = useMemo(() => {
    const canReadAllProfiles = hasPermission(
      user,
      "profile:all:read"
    );
    const canReadOwnProfile = hasPermission(
      user,
      "profile:own:read"
    );
    const fullDashboard = hasFullManagementDashboard(user?.role);

    return MANAGEMENT_SECTIONS.map((section) => ({
      ...section,
      links: section.links
        .map((link) =>
          link.to === "/staff/profile" && canReadAllProfiles
            ? {
                ...link,
                label: "Staff profiles",
                description: "Manage team photos, bios and specialties",
              }
            : link
        )
        .map((link) => ({
          ...link,
          icon: MANAGEMENT_ICONS[link.icon] || Sparkles,
          featureDisabled:
            Boolean(link.featureId) &&
            !isSuperAdminRole(user?.role) &&
            !isFeatureEnabled(link.featureId),
        }))
        .filter(
          (link) =>
            (!link.adminOnly || isAdminRole(user?.role)) &&
            (link.to !== "/staff/profile" ||
              canReadOwnProfile ||
              canReadAllProfiles) &&
            (!link.permission ||
              fullDashboard ||
              hasPermission(user, link.permission))
        ),
    })).filter((section) => section.links.length);
  }, [
    isFeatureEnabled,
    user?.permissions,
    user?.rolePermissions,
    user?.role,
  ]);

  const advancedToolCount = useMemo(
    () =>
      authorisedSections.reduce(
        (count, section) =>
          count + section.links.filter(isAdvancedManagementLink).length,
        0
      ),
    [authorisedSections]
  );

  const sections = useMemo(() => {
    const term = query.trim().toLowerCase();

    return authorisedSections
      .map((section) => ({
        ...section,
        links: section.links.filter((link) => {
          const matchesQuery =
            !term ||
            `${link.label} ${link.description}`
              .toLowerCase()
              .includes(term);

          return (
            matchesQuery &&
            isManagementLinkVisibleForPresentation(
              link,
              presentationMode,
              Boolean(term)
            )
          );
        }),
      }))
      .filter((section) => section.links.length);
  }, [authorisedSections, presentationMode, query]);

  function toggle(id) {
    setClosed((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleExpanded(id) {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function choosePresentationMode(mode) {
    setPresentationMode(mode);
    setClosed(new Set());
    setExpanded(new Set());
  }

  const isAdvancedMode =
    presentationMode === MANAGEMENT_PRESENTATION_MODES.ADVANCED;
  const hasQuery = Boolean(query) && query.trim().length > 0;

  return (
    <nav
      className="management-navigation"
      aria-label="Management workspaces"
      data-presentation-mode={presentationMode}
    >
      {!collapsed && advancedToolCount > 0 && (
        <div className="management-presentation">
          <div className="management-presentation-heading">
            <strong>Workspace view</strong>
            <span>
              Simple keeps routine work prominent. Advanced adds specialist
              tools you already have permission to use.
            </span>
          </div>
          <div
            className="management-presentation-options"
            role="group"
            aria-label="Management workspace view"
          >
            <button
              type="button"
              className="management-presentation-button"
              aria-pressed={!isAdvancedMode}
              onClick={() =>
                choosePresentationMode(
                  MANAGEMENT_PRESENTATION_MODES.SIMPLE
                )
              }
            >
              Simple
            </button>
            <button
              type="button"
              className="management-presentation-button"
              aria-pressed={isAdvancedMode}
              onClick={() =>
                choosePresentationMode(
                  MANAGEMENT_PRESENTATION_MODES.ADVANCED
                )
              }
            >
              Advanced
            </button>
          </div>
          <span className="management-presentation-status" aria-live="polite">
            {isAdvancedMode
              ? `Advanced view includes ${advancedToolCount} specialist ${
                  advancedToolCount === 1 ? "tool" : "tools"
                }.`
              : `${advancedToolCount} specialist ${
                  advancedToolCount === 1 ? "tool is" : "tools are"
                } available in Advanced view.`}
          </span>
        </div>
      )}

      {!collapsed && (
        <label className="management-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search management tasks and tools</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a task or tool…"
            type="search"
            autoComplete="off"
          />
        </label>
      )}

      {hasQuery && !collapsed && !isAdvancedMode && advancedToolCount > 0 && (
        <p className="management-search-hint">
          Search also includes authorised Advanced tools.
        </p>
      )}

      <div className="management-sections">
        {sections.map((section) => {
          const isClosed = !hasQuery && closed.has(section.id);
          const showAll =
            hasQuery || collapsed || expanded.has(section.id);
          const visibleLinks = showAll
            ? section.links
            : section.links.slice(0, MANAGEMENT_SECTION_PREVIEW);
          const hiddenCount = Math.max(
            0,
            section.links.length - visibleLinks.length
          );
          const sectionContentId = `management-section-${section.id}`;

          return (
            <section key={section.id} className="management-section">
              {!collapsed && (
                <button
                  type="button"
                  className="management-section-toggle"
                  onClick={() => toggle(section.id)}
                  aria-expanded={!isClosed}
                  aria-controls={sectionContentId}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={isClosed ? "is-closed" : ""}
                  />
                </button>
              )}

              {!isClosed && (
                <div id={sectionContentId}>
                  <div className="management-link-list">
                    {visibleLinks.map(
                      ({
                        to,
                        label,
                        description,
                        icon: Icon,
                        featureDisabled,
                        presentation,
                      }) => {
                        const advancedLink =
                          presentation ===
                          MANAGEMENT_PRESENTATION_MODES.ADVANCED;

                        return (
                          <NavLink
                            key={to}
                            to={to}
                            aria-disabled={
                              featureDisabled ? "true" : undefined
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
                                ? `${label}${
                                    advancedLink ? " — Advanced" : ""
                                  }`
                                : featureDisabled
                                  ? `${label} — currently off`
                                  : undefined
                            }
                            className={({ isActive }) =>
                              `management-link${
                                isActive ? " management-link-active" : ""
                              }${
                                featureDisabled
                                  ? " management-link-disabled"
                                  : ""
                              }`
                            }
                          >
                            <span className="management-link-icon">
                              <Icon size={18} aria-hidden="true" />
                            </span>
                            {!collapsed && (
                              <span className="management-link-copy">
                                <span className="management-link-title-row">
                                  <strong>{label}</strong>
                                  {advancedLink && (
                                    <span className="management-advanced-badge">
                                      Advanced
                                    </span>
                                  )}
                                </span>
                                <small>
                                  {featureDisabled
                                    ? "Currently off"
                                    : description}
                                </small>
                              </span>
                            )}
                          </NavLink>
                        );
                      }
                    )}
                  </div>

                  {!hasQuery &&
                    !collapsed &&
                    section.links.length > MANAGEMENT_SECTION_PREVIEW && (
                      <button
                        type="button"
                        className="management-section-more"
                        onClick={() => toggleExpanded(section.id)}
                        aria-expanded={showAll}
                        aria-controls={sectionContentId}
                      >
                        {showAll
                          ? "Show fewer tools"
                          : `Show ${hiddenCount} more tools`}
                      </button>
                    )}
                </div>
              )}
            </section>
          );
        })}

        {!sections.length && !collapsed && (
          <div className="app-empty-state compact" role="status">
            <Search size={22} aria-hidden="true" />
            <strong>No tasks or tools found</strong>
            <p>Try another customer, team, report or task name.</p>
          </div>
        )}
      </div>
    </nav>
  );
}
