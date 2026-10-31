import {
  Activity,
  BarChart3,
  Bot,
  Database,
  Link2,
  Mail,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Search,
  Send,
  Smartphone,
  Store,
  Target,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  PROVIDER_CONNECTIONS,
  providersForModule,
} from "../config/providerConnectionRegistry.js";

const KPI_CARDS = Object.freeze([
  { label: "Advertising spend", metric: "Spend", icon: Megaphone },
  { label: "Attributed revenue", metric: "Revenue", icon: BarChart3 },
  { label: "Return on ad spend", metric: "ROAS", icon: Target },
  { label: "Conversions", metric: "Conversions", icon: MousePointerClick },
  { label: "Customer acquisition cost", metric: "CAC", icon: Activity },
  { label: "Campaign engagement", metric: "CTR / response", icon: Send },
]);

const MARKETING_PROVIDER_GROUPS = Object.freeze([
  {
    title: "Advertising accounts",
    description: "Campaign, spend, click, conversion and account-performance evidence.",
    keys: ["google_ads", "facebook", "microsoft_ads", "apple_search_ads"],
  },
  {
    title: "Measurement & analytics",
    description: "First-party measurement, search performance, tagging and conversion evidence.",
    keys: ["ga4", "google_tag_manager", "google_search_console", "bing_webmaster"],
  },
  {
    title: "Marketing communications",
    description: "Marketing uses Communications for delivery; the same providers also serve transactional messaging.",
    keys: ["sendgrid", "twilio"],
  },
]);

const WORKSPACES = Object.freeze([
  {
    to: "/admin/system/connections",
    title: "Provider connections",
    description: "Connect Google, Meta, Microsoft, analytics and communications providers through the shared AIIBP connection framework.",
    icon: Link2,
  },
  {
    to: "/marketing/data-connections",
    title: "Marketing Data Hub",
    description: "Inspect tenant-bound source evidence, field profiles, imports, schedules, backfill and data health.",
    icon: Database,
  },
  {
    to: "/retention-automation",
    title: "Journeys & automation",
    description: "Build consent-aware marketing journeys using CRM audiences while Communications remains the delivery authority.",
    icon: Workflow,
  },
  {
    to: "/marketing-attribution",
    title: "Attribution & performance",
    description: "Review deterministic campaign/channel contribution, conversions, bookings/orders and revenue evidence.",
    icon: BarChart3,
  },
  {
    to: "/communications",
    title: "Email, SMS & WhatsApp",
    description: "Open Communications for transactional and marketing email, SMS and WhatsApp delivery, templates and delivery status.",
    icon: MessageCircle,
  },
  {
    to: "/customers",
    title: "CRM audiences",
    description: "Use canonical CRM customer profiles, lifecycle state and segments without moving customer ownership into Marketing.",
    icon: Target,
  },
  {
    to: "/marketing/data-connections?type=seller",
    title: "Seller & commerce evidence",
    description: "Bring marketplace and seller performance into analysis without making Marketing the marketplace authority.",
    icon: Store,
  },
  {
    to: "/ai/marketing-insights",
    title: "AI marketing assistant",
    description: "Interpret governed evidence, identify anomalies and opportunities, and propose actions for human review.",
    icon: Bot,
  },
]);

const CHANNELS = Object.freeze([
  { label: "Email marketing", provider: "Twilio SendGrid", icon: Mail },
  { label: "SMS marketing", provider: "Twilio Messaging", icon: Smartphone },
  { label: "WhatsApp marketing", provider: "Twilio Messaging", icon: MessageCircle },
]);

function providerByKey(key) {
  return PROVIDER_CONNECTIONS.find((provider) => provider.key === key) || null;
}

function priorityLabel(priority) {
  if (priority === "p0") return "Priority";
  if (priority === "conditional") return "Optional";
  if (priority === "planned") return "Planned";
  return "Available";
}

export default function MarketingModulePage() {
  const marketingProviders = providersForModule("marketing");

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
            <Megaphone size={18} /> AIIBP Marketing
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Marketing Command Centre</h1>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-stone-600">
            Govern advertising, measurement, audiences, campaigns, attribution and automation from one business-facing module. CRM remains the customer authority and Communications remains the Email, SMS and WhatsApp delivery authority for both transactional and marketing messages.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-stone-700">
            <span className="rounded-full bg-stone-100 px-3 py-1.5">{marketingProviders.length} shared provider contracts</span>
            <span className="rounded-full bg-stone-100 px-3 py-1.5">Tenant / location scoped</span>
            <span className="rounded-full bg-stone-100 px-3 py-1.5">Provider-neutral analytics</span>
            <span className="rounded-full bg-stone-100 px-3 py-1.5">Human-approved external actions</span>
          </div>
        </header>

        <section aria-labelledby="marketing-kpis">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-stone-950" id="marketing-kpis">Marketing performance</h2>
              <p className="mt-1 text-sm text-stone-600">Canonical KPI surfaces populate only from connected, tenant-scoped evidence.</p>
            </div>
            <Link className="text-sm font-semibold text-stone-900 underline underline-offset-4" to="/marketing-attribution">
              Open full attribution
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {KPI_CARDS.map(({ label, metric, icon: Icon }) => (
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" key={metric}>
                <div className="flex items-center justify-between gap-3">
                  <Icon aria-hidden="true" className="text-stone-600" size={20} />
                  <span className="rounded-full border border-stone-200 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-stone-500">Data Hub</span>
                </div>
                <div className="mt-4 text-sm font-semibold text-stone-700">{label}</div>
                <div className="mt-1 text-lg font-bold text-stone-950">Awaiting connected data</div>
                <div className="mt-1 text-xs text-stone-500">{metric} will appear when canonical source evidence is available.</div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="marketing-connections">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-stone-950" id="marketing-connections">Marketing connections</h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-stone-600">
                These providers use the shared AIIBP Connection Framework. OAuth providers redirect to the provider; API secrets are submitted to protected backend routes and are not displayed again after storage.
              </p>
            </div>
            <Link className="rounded-xl border border-stone-900 bg-stone-950 px-4 py-2.5 text-sm font-bold text-white" to="/admin/system/connections">
              Manage all connections
            </Link>
          </div>

          <div className="mt-4 space-y-4">
            {MARKETING_PROVIDER_GROUPS.map((group) => (
              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" key={group.title}>
                <h3 className="font-bold text-stone-950">{group.title}</h3>
                <p className="mt-1 text-sm leading-6 text-stone-600">{group.description}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {group.keys.map((key) => {
                    const provider = providerByKey(key);
                    if (!provider) return null;
                    return (
                      <Link
                        className="rounded-xl border border-stone-200 bg-stone-50 p-4 transition hover:border-stone-400 hover:bg-white"
                        key={provider.key}
                        to="/admin/system/connections"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-stone-950">{provider.label}</div>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">{priorityLabel(provider.priority)}</span>
                        </div>
                        <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{provider.authMode}</div>
                        <p className="mt-2 text-xs leading-5 text-stone-600">{provider.scopes.join(" · ")}</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section aria-labelledby="marketing-channels">
          <h2 className="text-xl font-bold text-stone-950" id="marketing-channels">Email, SMS & WhatsApp marketing</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-stone-600">
            Marketing defines the audience, campaign and journey. Communications owns templates, transport, delivery status, retries and channel consent for both transactional and marketing traffic.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {CHANNELS.map(({ label, provider, icon: Icon }) => (
              <Link className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-stone-400" key={label} to="/communications">
                <Icon aria-hidden="true" size={20} />
                <h3 className="mt-3 font-bold text-stone-950">{label}</h3>
                <p className="mt-1 text-sm text-stone-600">Delivery authority: {provider}</p>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="marketing-workspaces">
          <h2 className="text-xl font-bold text-stone-950" id="marketing-workspaces">Operational workspaces</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {WORKSPACES.map(({ to, title, description, icon: Icon }) => (
              <Link
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
                key={`${to}-${title}`}
                to={to}
              >
                <Icon aria-hidden="true" size={22} />
                <h3 className="mt-3 font-bold text-stone-950">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Search size={18} /><h2 className="font-bold text-stone-950">Analytics boundary</h2></div>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Provider metrics are retained with source provenance, then projected through the canonical metric catalogue for cross-channel reporting. Marketing does not invent or overwrite provider evidence.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Bot size={18} /><h2 className="font-bold text-stone-950">AI boundary</h2></div>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              AI may analyse campaign evidence, detect anomalies and recommend audiences or actions. It cannot expose provider secrets, cross tenant boundaries or execute consequential provider writes outside approved tool and human-review policy.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
