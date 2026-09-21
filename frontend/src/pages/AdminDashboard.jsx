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

import {
  Link,
} from "react-router-dom";

const cards = [
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

        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Manage salon services, staff identities, staff photographs, products,
          appointments, bulk imports and customer records.
        </p>
      </header>

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
