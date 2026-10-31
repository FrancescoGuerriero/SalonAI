import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Layers3, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { AIIBP_COMMERCIAL_MODULES } from "../config/aiibpCommercialModules.js";
import { AIIBP_MODULE_OPERATIONAL_SURFACE_BY_KEY } from "../config/aiibpModuleOperationalSurfaces.js";
import { getTenantProductComposition } from "../Services/tenantProductCompositionService.js";

const STATE_LABELS = Object.freeze({
  installed: "Installed",
  available: "Available",
  disabled: "Disabled",
  "vertical-restricted": "Vertical restricted",
});

function groupedModules() {
  const groups = new Map();
  for (const module of AIIBP_COMMERCIAL_MODULES) {
    const rows = groups.get(module.group) || [];
    rows.push(module);
    groups.set(module.group, rows);
  }
  return [...groups.entries()];
}

function tenantStateLabel({ compositionState, tenantModule, surface }) {
  if (!surface?.salonOperational) {
    return "Vertical restricted";
  }

  if (compositionState === "loading") {
    return "Checking entitlement";
  }

  if (compositionState === "unprovisioned") {
    return "Not provisioned";
  }

  if (compositionState !== "ready") {
    return "Tenant entitlement unavailable";
  }

  return STATE_LABELS[tenantModule?.tenantState] || "Unavailable";
}

function tenantStateReason({ compositionState, tenantModule, surface }) {
  if (!surface?.salonOperational) {
    return surface?.reason || "This module is not enabled for the SalonAI vertical.";
  }

  if (compositionState === "loading") {
    return "Tenant composition is still loading.";
  }

  if (compositionState === "unprovisioned") {
    return "No active tenant product manifest.";
  }

  if (compositionState !== "ready") {
    return "Tenant composition could not be verified.";
  }

  if (tenantModule?.tenantState === "available") {
    return "This commercial module is available to this vertical but is not installed for the current tenant.";
  }

  if (tenantModule?.tenantState === "disabled") {
    return tenantModule.reason || "This commercial module is disabled for the current tenant.";
  }

  if (tenantModule?.tenantState === "vertical-restricted") {
    return tenantModule.reason || "This commercial module is restricted for the current tenant vertical.";
  }

  return tenantModule?.reason || "This commercial module is not installed for the current tenant.";
}

export default function ModuleOperationsPage() {
  const groups = groupedModules();
  const [productComposition, setProductComposition] = useState(null);
  const [compositionState, setCompositionState] = useState("loading");

  useEffect(() => {
    let active = true;

    getTenantProductComposition()
      .then((composition) => {
        if (!active) return;
        setProductComposition(composition);
        setCompositionState(composition?.provisioned ? "ready" : "unprovisioned");
      })
      .catch(() => {
        if (!active) return;
        setProductComposition(null);
        setCompositionState("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const moduleStateByKey = useMemo(
    () => new Map((productComposition?.modules || []).map((module) => [module.key, module])),
    [productComposition]
  );

  const installedCount = useMemo(
    () => (productComposition?.modules || []).filter((module) => module.tenantState === "installed").length,
    [productComposition]
  );

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
            <Layers3 className="text-amber-600" size={19} /> AIIBP commercial module operations
          </div>
          <h1 className="mt-2 text-3xl font-bold text-black">Module Operations</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
            Open the canonical operational surface for each commercial module. This workspace does not duplicate module authority or replace the existing SalonAI dashboard; access is resolved from the current trusted tenant product manifest.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-emerald-900">
              {compositionState === "ready" ? `${installedCount} installed modules` : "Tenant composition not ready"}
            </span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-black">
              {AIIBP_COMMERCIAL_MODULES.length} commercial modules in platform catalogue
            </span>
          </div>
        </header>

        {groups.map(([group, modules]) => (
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" key={group}>
            <h2 className="text-xl font-bold text-black">{group}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => {
                const surface = AIIBP_MODULE_OPERATIONAL_SURFACE_BY_KEY[module.key];
                const tenantModule = moduleStateByKey.get(module.key) || null;
                const installed = Boolean(
                  surface?.salonOperational &&
                  surface?.primaryRoute &&
                  compositionState === "ready" &&
                  tenantModule?.tenantState === "installed"
                );
                const stateLabel = tenantStateLabel({ compositionState, tenantModule, surface });
                const reason = installed
                  ? ""
                  : tenantStateReason({ compositionState, tenantModule, surface });

                return (
                  <article className="flex min-h-56 flex-col rounded-2xl border border-black/10 bg-stone-50 p-5" key={module.key}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{module.key}</p>
                        <h3 className="mt-1 text-lg font-bold text-black">{module.label}</h3>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${installed ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-black"}`}>
                        {stateLabel}
                      </span>
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-6 text-stone-600">{module.summary}</p>

                    {installed ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black bg-amber-400 px-3.5 py-2 text-sm font-semibold text-black hover:bg-amber-300" to={surface.primaryRoute}>
                          Open module <ExternalLink size={15} />
                        </Link>
                        {surface.sellerRoute ? (
                          <Link className="inline-flex min-h-10 items-center rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-black hover:bg-amber-100" to={surface.sellerRoute}>
                            Seller accounts
                          </Link>
                        ) : null}
                        {surface.customerRoute ? (
                          <Link className="inline-flex min-h-10 items-center rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-black hover:bg-amber-100" to={surface.customerRoute}>
                            Customer surface
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-black">
                        <ShieldCheck className="mt-0.5 shrink-0" size={15} />
                        <span>{reason}</span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
