import {
  useEffect,
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
import ManagementNavigation, {
  MANAGEMENT_LINKS,
} from "./navigation/ManagementNavigation.jsx";
import Seo from "./Seo.jsx";

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
  const location =
    useLocation();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

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

    const close =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setMobileOpen(
            false
          );
        }
      };

    document.addEventListener(
      "keydown",
      close
    );

    return () => {
      document.body.style
        .overflow =
        prior;

      document.removeEventListener(
        "keydown",
        close
      );
    };
  }, [mobileOpen]);

  return (
    <div className="app-shell">
      <Seo />

      {/*
       * Public/customer screens use the main Navbar burger on mobile.
       * Management screens use the management sidebar/burger instead.
       * Rendering both was the source of the duplicate mobile menus.
       */}
      {!management ? <Navbar /> : null}

      {!management ? (
        <>
          <main className="app-public-main">
            <Outlet />
          </main>

          <SalonChatbot />
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

          {mobileOpen ? (
            <div
              className="app-mobile-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Management navigation"
            >
              <button
                type="button"
                className="app-mobile-backdrop"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                aria-label="Close management navigation"
              />

              <aside
                className="management-mobile-panel"
                id="salonai-management-mobile-navigation"
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
