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

import { AIIBP_COMMERCIAL_MODULES } from "../config/aiibpCommercialModules.js";

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

function groupedModules() {
  const groups = new Map();
  for (const module of AIIBP_COMMERCIAL_MODULES) {
    if (!groups.has(module.group)) groups.set(module.group, []);
    groups.get(module.group).push(module);
  }
  return [...groups.entries()];
}

export default function AdminDashboard() {
  const newModules = AIIBP_COMMERCIAL_MODULES.filter(({ newCommercial }) => newCommercial);
  const moduleGroups = groupedModules();

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8" id="main-content" tabIndex="-1">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Administration</span>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">SalonAI Admin Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage the current tenant and review the commercial modules available for modular SaaS tenant configurations.
        </p>
      </header>

      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm" aria-labelledby="commercial-modules-heading">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">Commercial module catalogue</span>
          <h2 id="commercial-modules-heading" className="mt-2 text-xl font-bold text-slate-950">
            {AIIBP_COMMERCIAL_MODULES.length} allocatable commercial modules
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
            Tenant platforms are composed from these modules. Each module owns a distinct business domain and can be selected with other modules; declared dependencies are resolved by the platform rather than duplicated in the tenant application.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {newModules.map((module) => (
            <article key={module.key} className="rounded-xl border-2 border-cyan-400 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-slate-950">{module.label}</div>
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-900">New module</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{module.summary}</p>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Key: {module.key}</div>
            </article>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {moduleGroups.map(([group, modules]) => (
            <section key={group} aria-labelledby={`module-group-${group.replaceAll(" ", "-").toLowerCase()}`}>
              <h3 id={`module-group-${group.replaceAll(" ", "-").toLowerCase()}`} className="text-sm font-bold uppercase tracking-wide text-slate-700">
                {group}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {modules.map((module) => (
                  <article key={module.key} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-950">{module.label}</div>
                      {module.newCommercial ? (
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-900">New</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{module.summary}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <h2 className="mt-4 text-lg font-bold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
              <span className="mt-4 inline-flex text-sm font-bold text-black">Manage</span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
