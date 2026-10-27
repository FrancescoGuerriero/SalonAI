import {
  CalendarDays,
  Layers3,
  PackagePlus,
  Scissors,
  Upload,
  UserPlus,
  UsersRound,
  Wrench,
  ToggleLeft,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import {
  AIIBP_COMMERCIAL_MODULES,
} from "../config/aiibpCommercialModules.js";

const cards = [
  {
    title: "SaaS modules",
    description:
      "Review the AIIBP commercial module catalogue and the modules available to compose tenant-specific SaaS platforms.",
    link:
      "/platform/modules",
    icon:
      Layers3,
  },
  {
    title: "On/Off Ideas",
    description:
      "Enable or disable app options using administrator-owned backend controls.",
    link:
      "/admin/system",
    icon:
      ToggleLeft,
  },
  {
    title: "Services",
    description:
      "Manage salon services, pricing and availability.",
    link:
      "/manage/services",
    icon:
      Wrench,
  },
  {
    title: "Employees",
    description:
      "Add employees and control roles, active, published and bookable settings.",
    link:
      "/admin/employees",
    icon:
      UserPlus,
  },
  {
    title: "Products & inventory",
    description:
      "Add new retail products and manage catalogue, prices, stock and reorder levels.",
    link:
      "/manage/inventory",
    icon:
      PackagePlus,
  },
  {
    title: "Bulk data import",
    description:
      "Upload customer or product CSV files with validation, duplicate handling and an audit trail.",
    link:
      "/data-imports",
    icon:
      Upload,
  },
  {
    title: "Appointments",
    description:
      "Manage salon appointments and booking activity.",
    link:
      "/appointments",
    icon:
      CalendarDays,
  },
  {
    title: "Customers",
    description:
      "Manage customer records and account information.",
    link:
      "/customers",
    icon:
      UsersRound,
  },
  {
    title: "Staff profiles",
    description:
      "Review how staff profiles, photos and public professional details appear across SalonAI.",
    link:
      "/staff/profile",
    icon:
      Scissors,
  },
];

export default function AdminDashboard() {
  const newModules = AIIBP_COMMERCIAL_MODULES.filter(({ newCommercial }) => newCommercial);

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
          Administration
        </span>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          SalonAI Admin Dashboard
        </h1>

        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage the current SalonAI tenant and review the AIIBP commercial modules
          available for future modular SaaS tenant configurations.
        </p>
      </header>

      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
              AIIBP commercial expansion
            </span>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              {AIIBP_COMMERCIAL_MODULES.length} allocatable commercial module experiences
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              Four distinctive modules have been added as first-class commercial products.
              Existing capabilities remain inside the modules that already own them, so
              tenant configurations do not duplicate business authority.
            </p>
          </div>
          <Link
            to="/platform/modules"
            className="inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white no-underline"
          >
            Review module catalogue
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {newModules.map((module) => (
            <article key={module.key} className="rounded-xl border border-cyan-200 bg-white p-4">
              <div className="text-sm font-bold text-slate-950">{module.label}</div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{module.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(
          (card) => {
            const Icon =
              card.icon;

            return (
              <Link
                key={
                  card.title
                }
                to={
                  card.link
                }
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-black">
                  <Icon
                    size={21}
                  />
                </div>

                <h2 className="mt-4 text-lg font-bold text-slate-900">
                  {card.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {
                    card.description
                  }
                </p>

                <span className="mt-4 inline-flex text-sm font-bold text-black">
                  Manage
                </span>
              </Link>
            );
          }
        )}
      </section>
    </main>
  );
}
