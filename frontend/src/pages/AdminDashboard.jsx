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
  },
  {
    title: "Employees",
    description: "Add employees and control roles, active, published and bookable settings.",
    link: "/admin/employees",
    icon: UserPlus,
  },
  {
    title: "Products & inventory",
    description: "Add new retail products and manage catalogue, prices, stock and reorder levels.",
    link: "/manage/inventory",
    icon: PackagePlus,
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
  },
  {
    title: "Customers",
    description: "Manage customer records and account information.",
    link: "/customers",
    icon: UsersRound,
  },
  {
    title: "Staff profiles",
    description: "Review how staff profiles, photos and public professional details appear across SalonAI.",
    link: "/staff/profile",
    icon: Scissors,
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
    description: "Complete business-facing catalogue. Tenant dashboards will show installed, available and disabled states from the tenant product manifest.",
    modules: AIIBP_COMMERCIAL_BUSINESS_MODULES,
  },
]);

function ModuleListingCard({ module }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900">{module.label}</h3>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {module.moduleClass}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{module.summary}</p>
    </>
  );

  if (module.link) {
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

export default function AdminDashboard() {
  return (
    <main className="space-y-8 p-4 sm:p-6 lg:p-8" id="main-content" tabIndex="-1">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Administration</span>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">SalonAI Admin Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage the current tenant and review the complete AIIBP platform capability model. Operational shortcuts remain tenant-specific; the catalogues below distinguish core platform foundations, shared system capabilities and commercially installable modules.
        </p>
      </header>

      <section aria-labelledby="operational-shortcuts-heading">
        <div className="mb-3">
          <h2 id="operational-shortcuts-heading" className="text-lg font-bold text-slate-900">Tenant operational shortcuts</h2>
          <p className="mt-1 text-sm text-slate-600">Current SalonAI operational surfaces.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.link}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-black">
                  <Icon size={21} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                <span className="mt-4 inline-flex text-sm font-bold text-black">Manage</span>
              </Link>
            );
          })}
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
              {section.modules.map((module) => (
                <ModuleListingCard key={`${section.key}:${module.key}`} module={module} />
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
