import { useEffect, useMemo, useState } from "react";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import useAuth from "../hooks/useAuth.js";
import { getTenantProductComposition } from "../Services/tenantProductCompositionService.js";

const COMMERCIAL_MODULE_ROUTE_RULES = Object.freeze([
  ["appointments", ["/appointments", "/waitlist", "/booking-loss", "/smart-appointments"]],
  ["calendar", ["/calendar"]],
  ["business-planning", ["/booking-demand", "/capacity-planning", "/revenue-forecast", "/executive-command-centre"]],
  ["crm", ["/customers", "/customer-follow-ups", "/customer-segments", "/customer-value", "/rebooking-opportunities"]],
  ["ai-retention", ["/retention-actions", "/retention-predictions", "/retention-automation"]],
  ["memberships", ["/memberships"]],
  ["customer-experience", ["/customer-experience-management", "/feedback-analytics"]],
  ["loyalty", ["/loyalty"]],
  ["staff", ["/staff/self-service", "/team-availability", "/admin/employees", "/staff/profile", "/staff-rota", "/admin/staff-roles", "/staff-performance"]],
  ["services", ["/manage/services", "/manage/service-packages", "/service-performance"]],
  ["ecommerce-store", ["/manage/products"]],
  ["inventory", ["/manage/inventory", "/suppliers", "/purchase-orders", "/reorder-recommendations", "/inventory-forecasting"]],
  ["commerce", ["/manage/orders", "/gift-cards"]],
  ["marketing", ["/marketing", "/marketing-attribution"]],
  ["communications", ["/communications", "/communication-templates", "/scheduled-communications", "/communication-campaigns", "/message-delivery", "/rebooking-campaigns", "/notification-centre", "/push-notifications", "/email-campaigns", "/sms-reminders"]],
  ["analytics", ["/reports", "/premium-analytics"]],
  ["ai-receptionist", ["/ai-receptionist", "/whatsapp-booking"]],
  ["ai-decision-support", ["/management-copilot"]],
  ["ai-stylist-copilot", ["/stylist-copilot"]],
]);

export function commercialModuleKeyForPath(path) {
  const pathname = String(path || "").split("?")[0];
  for (const [moduleKey, routes] of COMMERCIAL_MODULE_ROUTE_RULES) {
    if (routes.some((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`))) {
      return moduleKey;
    }
  }
  return "";
}

function blockedReason(state, moduleState) {
  if (state === "unprovisioned") return "No active tenant product manifest.";
  if (state === "unavailable") return "Tenant entitlement could not be verified.";
  if (moduleState?.tenantState === "vertical-restricted") return "This module is not available for the current vertical.";
  if (moduleState?.tenantState === "disabled") return moduleState.reason || "This module is disabled for the current tenant.";
  if (moduleState?.tenantState === "available") return "This module is available to install but is not installed for the current tenant.";
  return "This commercial module is not installed for the current tenant.";
}

export default function CommercialModuleEntitlementBoundary({ pathname, children }) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const moduleKey = commercialModuleKeyForPath(pathname);
  const [composition, setComposition] = useState(null);
  const [compositionState, setCompositionState] = useState("idle");

  useEffect(() => {
    let active = true;

    if (!moduleKey || authLoading || !isAuthenticated) {
      setComposition(null);
      setCompositionState("idle");
      return () => {
        active = false;
      };
    }

    setCompositionState("loading");
    getTenantProductComposition()
      .then((result) => {
        if (!active) return;
        setComposition(result);
        setCompositionState(result?.provisioned ? "ready" : "unprovisioned");
      })
      .catch(() => {
        if (!active) return;
        setComposition(null);
        setCompositionState("unavailable");
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, moduleKey]);

  const moduleState = useMemo(
    () => (composition?.modules || []).find((module) => module.key === moduleKey) || null,
    [composition, moduleKey]
  );

  if (!moduleKey || !isAuthenticated) {
    return children;
  }

  if (authLoading || compositionState === "idle" || compositionState === "loading") {
    return <LoadingSpinner />;
  }

  if (compositionState === "ready" && moduleState?.tenantState === "installed") {
    return children;
  }

  return (
    <section
      className="mx-auto my-8 max-w-3xl rounded-2xl border border-amber-300 bg-amber-50 p-6 text-slate-900 shadow-sm"
      role="status"
      aria-live="polite"
      data-commercial-module-blocked={moduleKey}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Commercial module unavailable</p>
      <h1 className="mt-2 text-2xl font-bold">This workspace is not enabled for this tenant</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        {blockedReason(compositionState, moduleState)}
      </p>
    </section>
  );
}
