import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Sparkles,
  X,
} from "lucide-react";

import Footer from "./Footer.jsx";
import Navbar from "./Navbar.jsx";
import SalonChatbot from "./chatbot/SalonChatbot.jsx";
import SalonAiAdviser from "./ai/SalonAiAdviser.jsx";
import ManagementNavigation, {
  MANAGEMENT_LINKS,
} from "./navigation/ManagementNavigation.jsx";
import Seo from "./Seo.jsx";
import useFeatureControls from "../hooks/useFeatureControls.js";
import useModalFocusTrap from "../hooks/useModalFocusTrap.js";
import useAuth from "../hooks/useAuth.js";
import {
  hasPermission,
} from "../utils/permissions.js";

const KEY =
  "salonai-management-sidebar-collapsed";

const ROUTES =
  MANAGEMENT_LINKS.map(
    ({
      to,
    }) => to
  );

const isManagementRoute =
  (path) =>
    ROUTES.some(
      (route) =>
        path === route ||
        path.startsWith(
          `${route}/`
        )
    );

export default function MainLayout() {
  const { isFeatureEnabled } = useFeatureControls();
  const {
    user,
  } = useAuth();
  const location =
    useLocation();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const mobileTriggerRef =
    useRef(null);
  const mobilePanelRef =
    useRef(null);

  const [
    collapsed,
    setCollapsed,
  ] = useState(() => {
    try {
      return (
        localStorage.getItem(
          KEY
        ) === "true"
      );
    } catch {
      return false;
    }
  });

  const management =
    isManagementRoute(
      location.pathname
    );

  useModalFocusTrap({
    open: mobileOpen,
    containerRef:
      mobilePanelRef,
    returnFocusRef:
      mobileTriggerRef,
    setOpen: setMobileOpen,
  });

  useEffect(
    () =>
      setMobileOpen(
        false
      ),
    [location.pathname]
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        String(collapsed)
      );
    } catch {
      // Local storage is optional.
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const prior =
      document.body.style
        .overflow;

    document.body.style
      .overflow = "hidden";


    return () => {
      document.body.style
        .overflow =
        prior;

    };
  }, [mobileOpen]);

  return (
    <div className="app-shell">
      <Seo />

      {/*
       * The global Navbar is part of every SalonAI page.
       * Management pages additionally expose the management sidebar/burger
       * as workspace navigation rather than replacing the global header.
       */}
      <Navbar />

      {!management ? (
        <>
          <main className="app-public-main">
            <Outlet />
          </main>

          {isFeatureEnabled("salon-chatbot") ? <SalonChatbot /> : null}
        </>
      ) : (
        <div className="management-shell">
          <aside
            className={`management-sidebar${
              collapsed
                ? " is-collapsed"
                : ""
            }`}
          >
            <div className="management-sidebar-head">
              {!collapsed ? (
                <div>
                  <span className="app-eyebrow">
                    SalonAI
                  </span>
                  <strong>
                    Management
                  </strong>
                </div>
              ) : (
                <Sparkles size={20} aria-label="SalonAI" />
              )}

              <button
                type="button"
                className="app-icon-button"
                onClick={() =>
                  setCollapsed(
                    (
                      value
                    ) =>
                      !value
                  )
                }
                aria-label={
                  collapsed
                    ? "Expand sidebar"
                    : "Collapse sidebar"
                }
              >
                {collapsed ? (
                  <ChevronRight
                    size={18}
                  />
                ) : (
                  <ChevronLeft
                    size={18}
                  />
                )}
              </button>
            </div>

            <div className="management-sidebar-scroll">
              <ManagementNavigation
                collapsed={
                  collapsed
                }
              />
            </div>

            {!collapsed ? (
              <div className="management-sidebar-foot">
                <div className="management-workspace-card">
                  <span>
                    SalonAI workspace
                  </span>

                  <p>
                    Customer, operations, inventory, communications and AI
                    tools.
                  </p>
                </div>
              </div>
            ) : null}
          </aside>

          <section className="management-content">
            <div className="management-mobile-bar">
              <button
                ref={mobileTriggerRef}
                type="button"
                className="app-button app-button-secondary"
                onClick={() =>
                  setMobileOpen(
                    true
                  )
                }
                aria-expanded={mobileOpen}
                aria-controls="salonai-management-mobile-navigation"
              >
                <Menu
                  size={18}
                />
                Menu
              </button>

              <span>
                <Sparkles size={16} /> SalonAI management
              </span>
            </div>

            <div className="management-page">
              <Outlet />
            </div>
          </section>

          {hasPermission(
            user,
            "ai:use"
          ) ? (
            <SalonAiAdviser
              contextPath={
                location.pathname
              }
            />
          ) : null}

          {mobileOpen ? (
            <div
              className="app-mobile-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Management navigation"
            >
              <div
                className="app-mobile-backdrop"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                aria-hidden="true"
              />

              <aside
                ref={mobilePanelRef}
                className="management-mobile-panel"
                id="salonai-management-mobile-navigation"
                tabIndex="-1"
              >
                <div className="app-mobile-panel-head">
                  <div>
                    <span className="app-eyebrow">
                      SalonAI
                    </span>

                    <strong>
                      Management
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="app-icon-button"
                    onClick={() =>
                      setMobileOpen(
                        false
                      )
                    }
                    aria-label="Close management navigation"
                  >
                    <X
                      size={20}
                    />
                  </button>
                </div>

                <div className="management-sidebar-scroll">
                  <ManagementNavigation
                    onNavigate={() =>
                      setMobileOpen(
                        false
                      )
                    }
                  />
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      )}

      {!management ? <Footer /> : null}
    </div>
  );
}
