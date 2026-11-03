import { useEffect, useMemo, useState } from "react";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { aiibpCommercialModuleKeyForRoute } from "../config/aiibpModuleOperationalSurfaces.js";
import useAuth from "../hooks/useAuth.js";
import { getTenantProductComposition } from "../Services/tenantProductCompositionService.js";

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
  const moduleKey = aiibpCommercialModuleKeyForRoute(pathname);
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
