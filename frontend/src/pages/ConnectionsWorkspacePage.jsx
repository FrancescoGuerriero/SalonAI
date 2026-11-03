import { useCallback, useEffect, useState } from "react";
import {
  CircleAlert,
  Link2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import PartnerMarketplacePanel from "../components/admin/PartnerMarketplacePanel.jsx";
import ProviderConnectionDirectory from "../components/integrations/ProviderConnectionDirectory.jsx";
import useAuth from "../hooks/useAuth.js";
import marketingConnections from "../Services/marketingConnectionsService.js";
import { hasPermission } from "../utils/permissions.js";

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function ConnectionsWorkspacePage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "feature-control:update");
  const [managedItems, setManagedItems] = useState([]);
  const [nativeItems, setNativeItems] = useState([]);
  const [runtime, setRuntime] = useState({ configured: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [managedResult, nativeResult] = await Promise.allSettled([
        marketingConnections.getManagedDataConnectionCatalogue(),
        marketingConnections.getMarketingAccounts(),
      ]);

      if (managedResult.status === "fulfilled") {
        const payload = managedResult.value;
        setManagedItems(Array.isArray(payload?.items) ? payload.items : []);
        setRuntime(payload?.runtime || { configured: false });
      } else {
        setManagedItems([]);
        setRuntime({ configured: false });
      }

      if (nativeResult.status === "fulfilled") {
        setNativeItems(Array.isArray(nativeResult.value?.items) ? nativeResult.value.items : []);
      } else {
        setNativeItems([]);
      }

      if (managedResult.status === "rejected" && nativeResult.status === "rejected") {
        throw managedResult.reason || nativeResult.reason;
      }
    } catch (requestError) {
      setError(
        errorMessage(
          requestError,
          "The AIIBP provider connection catalogue could not be loaded."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
                Connect business service providers once and reuse the governed connection across installed modules. Advertising, analytics, communications, marketplaces, accounting, payments and future integrations share the same Business/Location ownership, credential security, verification and audit boundaries.
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
              <RefreshCw size={17} /> {loading ? "Refreshing" : "Refresh connections"}
            </button>
          </div>

          {!runtime.configured ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-black" role="alert">
              The managed OAuth adapter runtime is not configured in this environment. The connection UI and protected credential-based connectors remain visible for source/manual acceptance, but live managed OAuth/account discovery stays disabled until its server-side adapter configuration is explicitly activated.
            </div>
          ) : null}

          {!canManage ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
              <ShieldCheck className="mt-0.5 shrink-0" size={17} />
              You have read access. Connecting, reconnecting, verifying or changing provider credentials requires feature-control update permission.
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <CircleAlert className="mt-0.5 shrink-0" size={17} />
            <span>{error}</span>
          </div>
        ) : null}

        <ProviderConnectionDirectory
          canManage={canManage}
          managedItems={managedItems}
          nativeItems={nativeItems}
          onChanged={load}
          runtime={runtime}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Advanced connection workspaces">
          <Link className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm hover:bg-amber-50" to="/marketing/data-connections">
            <h2 className="font-bold text-black">Data connection operations</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Preview, import, backfill and schedule provider data through governed Data Hub contracts.</p>
          </Link>
          <Link className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm hover:bg-amber-50" to="/marketing/data-connections?type=seller">
            <h2 className="font-bold text-black">Seller connections</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Operate Amazon Seller Central, eBay and other marketplace seller data sources.</p>
          </Link>
          <Link className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm hover:bg-amber-50" to="/marketing/native-connections">
            <h2 className="font-bold text-black">Advanced connector diagnostics</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Review provider-native verification, readiness and low-level connection diagnostics.</p>
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
