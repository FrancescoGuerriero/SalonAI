import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Link } from "react-router-dom";

import PartnerMarketplacePanel from "../components/admin/PartnerMarketplacePanel.jsx";
import useAuth from "../hooks/useAuth.js";
import marketingConnections from "../Services/marketingConnectionsService.js";
import { hasPermission } from "../utils/permissions.js";

const PRIORITY_CONNECTORS = Object.freeze([
  {
    key: "google_ads",
    label: "Google Ads (AdWords)",
    description:
      "Connect the business Google Ads account for campaign, ad group, keyword, spend, click and conversion evidence.",
    fallbackCategory: "Advertising",
  },
  {
    key: "amazon_seller_central",
    label: "Amazon Seller Central",
    description:
      "Connect Seller Central through the governed Amazon SP-API path for seller, order, catalogue and performance evidence.",
    fallbackCategory: "Marketplace & commerce",
  },
]);

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function connectionStatus(item) {
  const connection = item?.connection || {};
  if (connection.connected) return "Connected";
  if (connection.status === "pending") return "Authorisation pending";
  if (item?.available === false) return "Adapter unavailable";
  if (item?.available === null) return "Availability not checked";
  return "Ready to connect";
}

function statusClasses(item) {
  if (item?.connection?.connected) {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (item?.available === false) {
    return "border-red-300 bg-red-50 text-red-900";
  }
  return "border-amber-300 bg-amber-50 text-black";
}

export default function ConnectionsWorkspacePage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "feature-control:update");
  const [items, setItems] = useState([]);
  const [runtime, setRuntime] = useState({ configured: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await marketingConnections.getManagedDataConnectionCatalogue();
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setRuntime(payload?.runtime || { configured: false });
    } catch (requestError) {
      setError(
        errorMessage(
          requestError,
          "The AIIBP managed connection catalogue could not be loaded."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connectorByKey = useMemo(() => {
    const map = new Map();
    for (const item of items) map.set(item.key, item);
    return map;
  }, [items]);

  async function authorize(item) {
    setBusy(item.key);
    setError("");
    setNotice("");
    try {
      const payload = await marketingConnections.authorizeManagedDataConnection(item.key);
      if (!payload?.authorizationUrl) {
        throw new Error("The provider adapter did not return an authorisation URL.");
      }
      window.open(payload.authorizationUrl, "_blank", "noopener,noreferrer");
      setNotice(
        `${item.label}: complete provider authorisation in the new tab, then use Check connection.`
      );
      await load();
    } catch (requestError) {
      setError(
        errorMessage(requestError, `${item.label} authorisation could not be started.`)
      );
    } finally {
      setBusy("");
    }
  }

  async function reconcile(item) {
    setBusy(item.key);
    setError("");
    setNotice("");
    try {
      const payload = await marketingConnections.reconcileManagedDataConnection(item.key);
      setNotice(
        payload?.connected
          ? `${item.label}: ${payload.accountCount} connected account${payload.accountCount === 1 ? "" : "s"} confirmed for this business.`
          : `${item.label}: no linked provider account is confirmed for this business yet.`
      );
      await load();
    } catch (requestError) {
      setError(
        errorMessage(requestError, `${item.label} connection could not be reconciled.`)
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main
      className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8"
      id="main-content"
      tabIndex="-1"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
                <Link2 className="text-amber-600" size={18} /> AIIBP Integration Platform
              </div>
              <h1 className="mt-2 text-3xl font-bold text-black">Connections</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
                Connect and operate business accounts from one place without duplicating provider authority. Google Ads, Amazon Seller Central, seller channels, analytics, CRM, social/business accounts and partner apps continue to use their canonical Integration Platform, Data Hub and Marketplace services.
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-stone-100 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-100 disabled:opacity-50"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                load();
              }}
              type="button"
            >
              <RefreshCw size={17} /> Refresh connections
            </button>
          </div>

          {!runtime.configured ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-black" role="alert">
              The managed connection adapter is not configured in this environment. The UI and provider contracts remain available, but live OAuth/account discovery requires the server-side connection adapter and provider credentials.
            </div>
          ) : null}

          {!canManage ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
              <ShieldCheck className="mt-0.5 shrink-0" size={17} />
              You have read access. Connecting, reconnecting or reconciling provider accounts requires feature-control update permission.
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <CircleAlert className="mt-0.5 shrink-0" size={17} />
            <span>{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            {notice}
          </div>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Store className="text-amber-600" size={20} />
            <h2 className="text-xl font-bold text-black">Priority business accounts</h2>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
            These are first-class managed connections. Account tokens and provider credentials remain server-side; imported evidence is scoped to the active Business and Location through the existing Data Hub contracts.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {PRIORITY_CONNECTORS.map((definition) => {
              const item = connectorByKey.get(definition.key);
              const effective = item || {
                key: definition.key,
                label: definition.label,
                category: definition.fallbackCategory,
                available: false,
                connection: {},
              };
              const connectorBusy = busy === definition.key;
              const connection = effective.connection || {};

              return (
                <article className="rounded-2xl border border-black/10 bg-stone-50 p-5" key={definition.key}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-black">{definition.label}</h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {effective.category || definition.fallbackCategory}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(effective)}`}>
                      {loading ? "Checking" : connectionStatus(effective)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-stone-600">{definition.description}</p>

                  {connection.accounts?.length ? (
                    <div className="mt-4 rounded-xl border border-black/10 bg-white p-3 text-sm">
                      <div className="font-semibold text-black">Connected accounts</div>
                      <ul className="mt-2 space-y-1 text-stone-600">
                        {connection.accounts.map((account) => (
                          <li key={account.accountId}>
                            {account.accountName || account.accountId} · {account.accountId}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black bg-amber-400 px-3.5 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!item || !canManage || !runtime.configured || effective.available === false || connectorBusy}
                      onClick={() => authorize(effective)}
                      type="button"
                    >
                      {connectorBusy ? <LoaderCircle className="animate-spin" size={16} /> : <ExternalLink size={16} />}
                      {connection.connected || connection.status === "pending" ? "Reconnect" : "Connect securely"}
                    </button>
                    {(connection.connected || connection.status === "pending") ? (
                      <button
                        className="min-h-10 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-black hover:bg-amber-100 disabled:opacity-50"
                        disabled={!canManage || connectorBusy}
                        onClick={() => reconcile(effective)}
                        type="button"
                      >
                        Check connection
                      </button>
                    ) : null}
                  </div>

                  {!item && !loading ? (
                    <p className="mt-3 text-xs leading-5 text-red-800">
                      This provider is not present in the active managed-connection catalogue. The connection is intentionally blocked rather than silently falling back to an ungoverned path.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm hover:bg-amber-50" to="/marketing/data-connections">
            <h2 className="font-bold text-black">All managed data connections</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Operate advertising, analytics, CRM, seller and data-platform connections.</p>
          </Link>
          <Link className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm hover:bg-amber-50" to="/marketing/data-connections?type=seller">
            <h2 className="font-bold text-black">Seller connections</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Open Amazon Seller Central and other marketplace seller connectors.</p>
          </Link>
          <Link className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm hover:bg-amber-50" to="/marketing/native-connections">
            <h2 className="font-bold text-black">Native marketing connectors</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Review provider-native marketing connection and verification workflows.</p>
          </Link>
          <Link className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm hover:bg-amber-50" to="/admin/system/connected-accounts">
            <h2 className="font-bold text-black">Business social accounts</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Manage Facebook, Instagram, LinkedIn and Google Business Profile connections.</p>
          </Link>
        </section>

        <PartnerMarketplacePanel />
      </div>
    </main>
  );
}
