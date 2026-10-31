import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  PackageSearch,
  RefreshCcw,
  RotateCcw,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { providersForModule } from "../config/providerConnectionRegistry.js";

const MARKETPLACE_PROVIDERS = providersForModule("seller-marketplace");

const KPI_CARDS = Object.freeze([
  { label: "Marketplace revenue", helper: "Canonical Commerce/Data Hub evidence" },
  { label: "Orders", helper: "Marketplace-attributed orders" },
  { label: "Units sold", helper: "Seller-channel unit volume" },
  { label: "Returns", helper: "Return/refund evidence" },
  { label: "Fees", helper: "Marketplace fee evidence" },
  { label: "Contribution", helper: "Revenue less governed fee/cost evidence" },
]);

const WORKSPACES = Object.freeze([
  {
    title: "Accounts & connections",
    description: "Connect Amazon Seller Central, eBay and Google Merchant Center using the shared AIIBP provider-connection framework.",
    to: "/admin/system/connections",
    icon: Store,
  },
  {
    title: "Listings & catalogue",
    description: "Review seller catalogue/listing evidence. Commerce and E-commerce remain canonical product/transaction authorities.",
    to: "/manage/products",
    icon: PackageSearch,
  },
  {
    title: "Inventory",
    description: "Review stock and replenishment state owned by Inventory & Purchasing and compare it with seller-channel evidence.",
    to: "/manage/inventory",
    icon: Boxes,
  },
  {
    title: "Orders & fulfilment",
    description: "Open canonical order operations while marketplace adapters supply seller-channel order and fulfilment evidence.",
    to: "/manage/orders",
    icon: Truck,
  },
  {
    title: "Performance & analytics",
    description: "Analyse governed seller KPIs through shared Data Hub, Metric Catalogue and Analytics contracts.",
    to: "/reports",
    icon: BarChart3,
  },
  {
    title: "Seller data workspace",
    description: "Inspect marketplace data connections, curated profiles, historical imports and seller KPI evidence.",
    to: "/marketing/data-connections?type=seller",
    icon: ShoppingBag,
  },
]);

const PLANNED_WORKSPACES = Object.freeze([
  {
    title: "Returns",
    description: "Unified marketplace return cases and provider return/refund reconciliation will be added without replacing Commerce refund authority.",
    icon: RotateCcw,
  },
  {
    title: "Finance",
    description: "Marketplace fees, settlements, payouts and reconciliation will consume provider evidence and accounting integrations through shared platform contracts.",
    icon: CircleDollarSign,
  },
  {
    title: "Pricing & promotions",
    description: "Governed pricing and promotion recommendations will remain human-approved before any provider write capability is enabled.",
    icon: RefreshCcw,
  },
]);

function ProviderCard({ provider }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-stone-950">{provider.label}</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{provider.category}</p>
        </div>
        <span className="rounded-full border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-bold text-stone-700">
          {provider.authMode === "oauth" ? "Provider sign-in" : "Secure credentials"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        {provider.scopes.join(" · ")}
      </p>
      <Link
        className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-black bg-amber-400 px-3.5 py-2 text-sm font-bold text-black hover:bg-amber-300"
        to="/admin/system/connections"
      >
        Manage connection
      </Link>
    </article>
  );
}

export default function MarketplaceCommandCentrePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
            <Store size={18} /> AIIBP Seller & Marketplace Management
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Marketplace Command Centre</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
            Manage marketplace accounts, seller evidence and operational performance without duplicating Commerce, Inventory, Analytics or Integration Hub authority. Provider writes remain disabled unless separately implemented, permissioned, approved and audited.
          </p>
        </header>

        <section aria-labelledby="marketplace-kpis">
          <h2 className="text-xl font-bold text-stone-950" id="marketplace-kpis">Marketplace performance</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {KPI_CARDS.map((item) => (
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" key={item.label}>
                <p className="text-sm font-semibold text-stone-600">{item.label}</p>
                <p className="mt-2 text-lg font-bold text-stone-950">Awaiting connected data</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">{item.helper}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="marketplace-providers">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-stone-950" id="marketplace-providers">Marketplace providers</h2>
              <p className="mt-1 text-sm text-stone-600">P0 seller channels reuse the shared secure connection framework.</p>
            </div>
            <Link className="text-sm font-bold text-stone-950 underline" to="/admin/system/connections">Open all connections</Link>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MARKETPLACE_PROVIDERS.map((provider) => <ProviderCard key={provider.key} provider={provider} />)}
          </div>
        </section>

        <section aria-labelledby="marketplace-workspaces">
          <h2 className="text-xl font-bold text-stone-950" id="marketplace-workspaces">Operational workspaces</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {WORKSPACES.map(({ title, description, to, icon: Icon }) => (
              <Link
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
                key={title}
                to={to}
              >
                <Icon aria-hidden="true" size={22} />
                <h3 className="mt-3 font-bold text-stone-950">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="marketplace-planned">
          <h2 className="text-xl font-bold text-stone-950" id="marketplace-planned">Planned governed operations</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {PLANNED_WORKSPACES.map(({ title, description, icon: Icon }) => (
              <article className="rounded-2xl border border-dashed border-stone-300 bg-white p-5" key={title}>
                <Icon aria-hidden="true" size={22} />
                <div className="mt-3 flex items-center gap-2">
                  <h3 className="font-bold text-stone-950">{title}</h3>
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-stone-600">Planned</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-stone-950">Canonical ownership and safety</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Seller & Marketplace Management owns the seller-channel portfolio, marketplace operations workspace and seller-performance projections. Commerce remains the source of truth for orders, payments and refunds; Inventory owns stock; Integration Hub owns provider connections and credentials; Analytics owns governed metrics. No production marketplace write, pricing change, promotion, listing mutation or AI-initiated seller action is enabled by this workspace.
          </p>
        </section>
      </div>
    </main>
  );
}
