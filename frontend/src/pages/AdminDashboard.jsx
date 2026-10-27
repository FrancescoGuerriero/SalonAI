import {
  Boxes,
  CalendarDays,
  PackagePlus,
  Scissors,
  ToggleLeft,
  Upload,
  UserPlus,
  UsersRound,
  Wrench,
} from "lucide-react";

import { Link } from "react-router-dom";

import { AIIBP_COMMERCIAL_MODULES } from "../config/aiibpCommercialModules.js";

const operationalCards = [
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

export default function AdminDashboard() {
  const newModules = AIIBP_COMMERCIAL_MODULES.filter(({ newCommercial }) => newCommercial);

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8" id="main-content" tabIndex="-1">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Administration</span>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">SalonAI Admin Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage day-to-day salon operations, staff, customers and the capabilities available to this tenant.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Salon administration">
        {operationalCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              to={card.link}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-black">
                <Icon size={21} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
              <span className="mt-4 inline-flex text-sm font-bold text-black">Manage</span>
            </Link>
          );
        })}
      </section>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        aria-labelledby="saas-modules-heading"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">AIIBP SaaS platform</span>
            <h2 id="saas-modules-heading" className="mt-2 text-xl font-bold text-slate-950">
              {AIIBP_COMMERCIAL_MODULES.length} commercial modules available
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review the reusable AIIBP module catalogue used to compose tenant products. Module composition does not replace SalonAI's canonical operational, tenancy or permission authorities.
            </p>
          </div>

          <Link
            to="/platform/modules"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-400 bg-amber-100 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            <Boxes size={19} aria-hidden="true" />
            SaaS modules
          </Link>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-bold text-slate-900">New commercial modules</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {newModules.map((module) => (
              <article key={module.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold text-slate-950">{module.label}</div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                    New
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{module.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
