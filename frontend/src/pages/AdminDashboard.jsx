import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  PackagePlus,
  Scissors,
  Upload,
  UserPlus,
  UsersRound,
  Wrench,
  ToggleLeft,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
  AIIBP_COMMERCIAL_BUSINESS_MODULES,
  AIIBP_CORE_PLATFORM_MODULES,
  AIIBP_SYSTEM_MODULES,
} from "../config/aiibpModuleRegistry.js";
import {
  getTenantProductComposition,
} from "../Services/tenantProductCompositionService.js";

const cards = [
  {
    title: "On/Off Ideas",
    description: "Enable or disable app options using administrator-owned backend controls.",
    link: "/admin/system",
    icon: ToggleLeft,
  },
  {
    title: "Services",
    description: "Manage salon services, pricing and availability.",
    link: "/manage/services",
    icon: Wrench,
    moduleKey: "services",
  },
  {
    title: "Employees",
    description: "Add employees and control roles, active, published and bookable settings.",
    link: "/admin/employees",
    icon: UserPlus,
    moduleKey: "staff",
  },
  {
    title: "Products & inventory",
    description: "Add new retail products and manage catalogue, prices, stock and reorder levels.",
    link: "/manage/inventory",
    icon: PackagePlus,
    moduleKey: "inventory",
  },
  {
    title: "Bulk data import",
    description: "Upload customer or product CSV files with validation, duplicate handling and an audit trail.",
    link: "/data-imports",
    icon: Upload,
  },
  {
    title: "Appointments",
    description: "Manage salon appointments and booking activity.",
    link: "/appointments",
    icon: CalendarDays,
    moduleKey: "appointments",
  },
  {
    title: "Customers",
    description: "Manage customer records and account information.",
    link: "/customers",
    icon: UsersRound,
    moduleKey: "crm",
  },
  {
    title: "Staff profiles",
    description: "Review how staff profiles, photos and public professional details appear across SalonAI.",
    link: "/staff/profile",
    icon: Scissors,
    moduleKey: "staff",
  },
];

const moduleSections = Object.freeze([
  {
    key: "core",
    title: "Core Platform Modules",
    description: "Always-on AIIBP foundations for tenant isolation, identity, authority, configuration, privacy, audit and governed AI.",
    modules: AIIBP_CORE_PLATFORM_MODULES,
  },
  {
    key: "system",
    title: "System Capabilities",
    description: "Shared engines used by installed business modules. These are included platform capabilities rather than duplicate commercial products.",
    modules: AIIBP_SYSTEM_MODULES,
  },
  {
    key: "commercial",
    title: "Commercial Modules",
    description: "Business-facing modules are labelled from the current tenant product manifest as Installed, Available, Disabled or Vertical restricted.",
    modules: AIIBP_COMMERCIAL_BUSINESS_MODULES,
  },
]);

const STATE_LABELS = Object.freeze({
  installed: "Installed",
  available: "Available",
  disabled: "Disabled",
  "vertical-restricted": "Vertical restricted",
});

const STATE_CLASSES = Object.freeze({
  installed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  available: "border-sky-200 bg-sky-50 text-sky-800",
  disabled: "border-amber-200 bg-amber-50 text-amber-800",
  "vertical-restricted": "border-slate-200 bg-slate-100 text-slate-500",
});

function ModuleListingCard({ module, tenantState = null, tenantReason = "" }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900">{module.label}</h3>
        <div className="flex flex-wrap justify-end gap-1.5">
          {tenantState ? (
            <span
              className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${STATE_CLASSES[tenantState] || STATE_CLASSES.available}`}
              title={tenantReason || undefined}
            >
              {STATE_LABELS[tenantState] || tenantState}
            </span>
          ) : null}
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {module.moduleClass}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{module.summary}</p>
      {tenantState === "disabled" && tenantReason ? (
        <p className="mt-2 text-xs font-semibold text-amber-800">Disabled: {tenantReason}</p>
      ) : null}
    </>
  );

  const canOpen = module.link && tenantState !== "vertical-restricted" && tenantState !== "disabled";

  if (canOpen) {
    return (
      <Link
        to={module.link}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {content}
    </article>
  );
}

function OperationalShortcutCard({ card, tenantModule = null, compositionState }) {
  const Icon = card.icon;
  const tenantState = card.moduleKey ? tenantModule?.tenantState || null : null;
  const entitlementReady = !card.moduleKey || (
    compositionState === "ready" && tenantState === "installed"
  );
  const statusLabel = card.moduleKey
    ? compositionState === "ready"
      ? STATE_LABELS[tenantState] || "Unavailable"
      : compositionState === "loading"
        ? "Checking entitlement"
        : compositionState === "unprovisioned"
          ? "Not provisioned"
          : "Entitlement unavailable"
    : "Platform capability";
  const reason = card.moduleKey && !entitlementReady
    ? tenantModule?.reason || (
        compositionState === "unprovisioned"
          ? "No active tenant product manifest."
          : compositionState === "unavailable"
            ? "Tenant composition could not be verified."
            : compositionState === "loading"
              ? "Tenant composition is still loading."
              : "This commercial module is not installed for the current tenant."
      )
    : "";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-black">
          <Icon size={21} />
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
            entitlementReady
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {statusLabel}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{card.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
      {reason ? (
        <p className="mt-3 text-xs font-semibold text-slate-600">{reason}</p>
      ) : null}
      <span className="mt-4 inline-flex text-sm font-bold text-black">
        {entitlementReady ? "Manage" : "Unavailable"}
      </span>
    </>
  );

  if (entitlementReady) {
    return (
      <Link
        to={card.link}
        className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm"
      aria-disabled="true"
    >
      {content}
    </article>
  );
}

export default function AdminDashboard() {
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
    () => new Map(
      (productComposition?.modules || []).map((module) => [module.key, module])
    ),
    [productComposition]
  );

  const stateCounts = useMemo(() => {
    const counts = {
      installed: 0,
      available: 0,
      disabled: 0,
      "vertical-restricted": 0,
    };

    for (const module of productComposition?.modules || []) {
      if (Object.prototype.hasOwnProperty.call(counts, module.tenantState)) {
        counts[module.tenantState] += 1;
      }
    }

    return counts;
  }, [productComposition]);

  return (
    <main className="space-y-8 p-4 sm:p-6 lg:p-8" id="main-content" tabIndex="-1">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Administration</span>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">SalonAI Admin Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage the current tenant and review the AIIBP capability model. Operational shortcuts remain tenant-specific; commercial module status is resolved from the current trusted tenant product manifest.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          {compositionState === "loading" ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">Loading tenant composition…</span>
          ) : null}
          {compositionState === "ready" ? (
            <>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
                {productComposition.vertical?.label || productComposition.vertical?.id || "Tenant vertical"}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">{stateCounts.installed} installed</span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-800">{stateCounts.available} available</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">{stateCounts.disabled} disabled</span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-600">{stateCounts["vertical-restricted"]} restricted</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
                Manifest revision {productComposition.manifest?.revision || "—"}
              </span>
            </>
          ) : null}
          {compositionState === "unprovisioned" ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">No active tenant product manifest</span>
          ) : null}
          {compositionState === "unavailable" ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-800">Tenant composition unavailable</span>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="operational-shortcuts-heading">
        <div className="mb-3">
          <h2 id="operational-shortcuts-heading" className="text-lg font-bold text-slate-900">Tenant operational shortcuts</h2>
          <p className="mt-1 text-sm text-slate-600">Current SalonAI operational surfaces. Commercial shortcuts open only when the current tenant manifest marks the module as installed.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <OperationalShortcutCard
              key={card.title}
              card={card}
              compositionState={compositionState}
              tenantModule={card.moduleKey ? moduleStateByKey.get(card.moduleKey) : null}
            />
          ))}
        </div>
      </section>

      <section className="space-y-8" aria-label="AIIBP module registry">
        {moduleSections.map((section) => (
          <section key={section.key} aria-labelledby={`module-${section.key}`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id={`module-${section.key}`} className="text-xl font-bold text-slate-900">
                  {section.title}
                </h2>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">{section.description}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                {section.modules.length} modules
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.modules.map((module) => {
                const tenantModule = section.key === "commercial"
                  ? moduleStateByKey.get(module.key)
                  : null;

                return (
                  <ModuleListingCard
                    key={`${section.key}:${module.key}`}
                    module={module}
                    tenantReason={tenantModule?.reason || ""}
                    tenantState={tenantModule?.tenantState || null}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
