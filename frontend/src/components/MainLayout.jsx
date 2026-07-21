import { useEffect, useState } from "react";
import {
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

import Navbar from "./Navbar.jsx";
import ManagementNavigation from "./navigation/ManagementNavigation.jsx";

const MANAGEMENT_ROUTES = [
  "/dashboard",
  "/customers",
  "/appointments",
  "/communications",
  "/manage/services",
];

function isManagementRoute(pathname) {
  return MANAGEMENT_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`)
  );
}

function getStoredCollapsedState() {
  try {
    return (
      window.localStorage.getItem(
        "salonai-management-sidebar-collapsed"
      ) === "true"
    );
  } catch {
    return false;
  }
}

function MainLayout() {
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(getStoredCollapsedState);

  const showManagementNavigation =
    isManagementRoute(location.pathname);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "salonai-management-sidebar-collapsed",
        String(sidebarCollapsed)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [sidebarCollapsed]);

  function toggleSidebar() {
    setSidebarCollapsed(
      (currentValue) => !currentValue
    );
  }

  function openMobileMenu() {
    setMobileMenuOpen(true);
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {!showManagementNavigation ? (
        <main className="app-container">
          <Outlet />
        </main>
      ) : (
        <div className="flex min-h-[calc(100vh-4rem)]">
          <aside
            className={`hidden shrink-0 border-r border-gray-200 bg-white transition-all duration-200 lg:block ${
              sidebarCollapsed
                ? "w-20"
                : "w-64"
            }`}
          >
            <div className="sticky top-0 flex h-screen flex-col">
              <div
                className={`flex min-h-20 items-center border-b border-gray-100 px-4 ${
                  sidebarCollapsed
                    ? "justify-center"
                    : "justify-between"
                }`}
              >
                {!sidebarCollapsed ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      SalonAI
                    </p>

                    <h2 className="mt-1 text-base font-bold text-gray-900">
                      Management
                    </h2>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
                  aria-label={
                    sidebarCollapsed
                      ? "Expand management sidebar"
                      : "Collapse management sidebar"
                  }
                  title={
                    sidebarCollapsed
                      ? "Expand sidebar"
                      : "Collapse sidebar"
                  }
                >
                  {sidebarCollapsed ? (
                    <ChevronRight size={18} />
                  ) : (
                    <ChevronLeft size={18} />
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-5">
                <ManagementNavigation
                  collapsed={sidebarCollapsed}
                />
              </div>

              {!sidebarCollapsed ? (
                <div className="border-t border-gray-100 p-4">
                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      SalonAI Workspace
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      Manage appointments, customers,
                      services and communications.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={openMobileMenu}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                aria-label="Open management navigation"
              >
                <Menu size={19} />
                Management menu
              </button>
            </div>

            <Outlet />
          </div>

          {mobileMenuOpen ? (
            <div
              className="fixed inset-0 z-50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Management navigation"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={closeMobileMenu}
                aria-label="Close management navigation"
              />

              <aside className="relative flex h-full w-[min(85vw,20rem)] flex-col bg-white shadow-2xl">
                <div className="flex min-h-20 items-center justify-between border-b border-gray-200 px-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      SalonAI
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-gray-900">
                      Management
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeMobileMenu}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                    aria-label="Close management navigation"
                  >
                    <X size={22} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <ManagementNavigation
                    onNavigate={closeMobileMenu}
                  />
                </div>

                <div className="border-t border-gray-200 p-4">
                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="font-semibold text-blue-900">
                      SalonAI Workspace
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      Salon management and customer
                      engagement tools.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default MainLayout;