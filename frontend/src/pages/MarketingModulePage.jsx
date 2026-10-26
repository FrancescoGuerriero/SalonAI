import { BarChart3, Bot, Database, Link2, Megaphone, Store, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

const WORKSPACES = [
  {
    to: "/marketing/data-connections",
    title: "Data connections",
    description: "Connect marketing, analytics, CRM, seller and business data sources through AIIBP and bring tenant-bound evidence into the Marketing Data Hub.",
    icon: Database,
  },
  {
    to: "/marketing/native-connections",
    title: "Native connections",
    description: "Use direct AIIBP provider connections where deeper first-party control or provider-specific verification is required.",
    icon: Link2,
  },
  {
    to: "/marketing/data-connections?type=seller",
    title: "Sellers",
    description: "Connect Amazon Seller Central, eBay and supported commerce marketplaces for seller performance, orders, fees, traffic and advertising evidence.",
    icon: Store,
  },
  {
    to: "/retention-automation",
    title: "Journeys & automation",
    description: "Build consent-aware retention journeys and governed marketing automation using canonical CRM audiences and Communications delivery.",
    icon: Workflow,
  },
  {
    to: "/marketing-attribution",
    title: "Attribution & performance",
    description: "Review deterministic campaign/channel impact, spend, conversions, bookings and revenue evidence.",
    icon: BarChart3,
  },
  {
    to: "/ai/marketing-insights",
    title: "AI marketing assistant",
    description: "Use governed AI to interpret marketing evidence, identify anomalies and opportunities, and propose actions for human review.",
    icon: Bot,
  },
];

export default function MarketingModulePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-600"><Megaphone size={18} /> AIIBP Marketing</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Marketing module</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
            One business-facing Marketing module combines provider data connections, seller data, campaigns, CRM audiences, automation, attribution and AI-assisted analysis. Internal engines keep separate canonical responsibilities so the same work is not duplicated across modules.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-bold text-stone-950">Workspaces</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {WORKSPACES.map(({ to, title, description, icon: Icon }) => (
              <Link
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
                key={to}
                to={to}
              >
                <Icon aria-hidden="true" size={22} />
                <h3 className="mt-3 font-bold text-stone-950">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-stone-950">Connection policy</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            AIIBP owns the connection catalogue, tenancy, Data Hub, scheduling, backfill, monitoring and business-facing experience. Direct provider adapters and optional managed connection adapters sit behind the same provider-neutral contracts. OAuth providers use secure provider authorization flows; the Marketing module must never collect a customer&apos;s provider password.
          </p>
        </section>
      </div>
    </main>
  );
}
