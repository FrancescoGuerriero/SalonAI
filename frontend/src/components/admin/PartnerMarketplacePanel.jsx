import {
  CheckCircle2,
  CircleAlert,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getMarketplaceCatalogue,
  getMarketplaceInstallations,
  prepareMarketplaceInstallation,
  reconcileMarketplaceInstallation,
} from "../../Services/partnerMarketplaceApi.js";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";

function idOf(value) {
  return String(value?._id || value?.id || value || "");
}

function statusClasses(status) {
  if (status === "connected" || status === "approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (status === "suspended" || status === "rejected") {
    return "border-red-300 bg-red-50 text-red-900";
  }
  return "border-amber-300 bg-amber-50 text-black";
}

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ");
}

function money(value, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
  }).format(Number(value || 0));
}

function commercialSummary(app) {
  const terms = app?.commercialTerms || {};
  switch (terms.billingModel) {
    case "fixed_subscription":
      return `${money(terms.monthlyAmount, terms.currency)} / month`;
    case "usage":
      return "Usage-based terms recorded; billing execution is not enabled.";
    case "revenue_share":
      return `${Number(terms.revenueSharePercent || 0)}% revenue-share terms recorded`;
    default:
      return "Free";
  }
}

function InstallationEvidence({ installation }) {
  if (!installation) {
    return (
      <p className="mt-4 rounded-xl border border-black/10 bg-white p-3 text-sm text-stone-600">
        Not prepared for this business.
      </p>
    );
  }

  const integration = installation.integrationApp || {};
  const reason = installation.metadata?.reconciliationReason || "";

  return (
    <div className="mt-4 rounded-xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Tenant installation
          </p>
          <p className="mt-1 font-semibold text-black">
            {integration.name || integration.key || "Prepared integration"}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(
            installation.status
          )}`}
        >
          {label(installation.status || "prepared")}
        </span>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-stone-700">Integration Platform</dt>
          <dd className="mt-1 text-stone-600">
            {label(integration.status || "draft")}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-stone-700">Connection authority</dt>
          <dd className="mt-1 text-stone-600">
            Integration Platform only
          </dd>
        </div>
      </dl>

      {reason ? (
        <p className="mt-3 text-xs leading-5 text-stone-500">
          Last reconciliation: {label(reason)}.
        </p>
      ) : null}
    </div>
  );
}

export default function PartnerMarketplacePanel() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "feature-control:update");
  const [catalogue, setCatalogue] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [apps, installed] = await Promise.all([
        getMarketplaceCatalogue(),
        getMarketplaceInstallations(),
      ]);
      setCatalogue(apps);
      setInstallations(installed);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "The Partner Marketplace could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const installationByApp = useMemo(() => {
    const result = new Map();
    for (const installation of installations) {
      const appId = idOf(installation.marketplaceApp);
      if (appId) result.set(appId, installation);
    }
    return result;
  }, [installations]);

  async function prepare(app) {
    if (!canManage) return;
    const appId = idOf(app);
    setBusyId(appId);
    setError("");
    setNotice("");
    try {
      await prepareMarketplaceInstallation(appId);
      await load();
      setNotice(
        `${app.name} is prepared. Configure credentials and the external connection through the Integration Platform before it can connect.`
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "The marketplace installation could not be prepared."
      );
    } finally {
      setBusyId("");
    }
  }

  async function reconcile(installation) {
    if (!canManage) return;
    const installationId = idOf(installation);
    setBusyId(installationId);
    setError("");
    setNotice("");
    try {
      const result = await reconcileMarketplaceInstallation(installationId);
      await load();
      setNotice(
        result?.installation?.status === "connected"
          ? "Canonical Integration Platform connection evidence is confirmed."
          : "Connection evidence was refreshed. Marketplace did not create or activate a connector."
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "The marketplace connection state could not be reconciled."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Store className="text-amber-600" size={20} />
            <h2 className="font-semibold text-black">Partner Marketplace</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Browse platform-approved partner apps and prepare tenant installations.
            Marketplace preparation never creates credentials, activates an external
            connection or starts billing. Those authorities remain with the existing
            Integration Platform and commercial controls.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-stone-100 px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw size={16} /> Refresh marketplace
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Approved apps
          </p>
          <p className="mt-1 text-2xl font-bold text-black">{catalogue.length}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Prepared / connected
          </p>
          <p className="mt-1 text-2xl font-bold text-black">
            {installations.filter((item) => item.status !== "uninstalled").length}
          </p>
        </div>
        <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Automatic billing
          </p>
          <p className="mt-1 font-bold text-black">Disabled</p>
        </div>
      </div>

      {error ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
          role="alert"
        >
          <CircleAlert className="mt-0.5 shrink-0" size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
          <span>{notice}</span>
        </div>
      ) : null}

      {!canManage ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
          <ShieldCheck className="mt-0.5 shrink-0" size={17} />
          <span>
            You have read access. Preparing or reconciling an installation requires
            feature-control update permission.
          </span>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-stone-600">Loading approved partner apps…</p>
      ) : null}

      {!loading && catalogue.length === 0 ? (
        <p className="mt-6 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
          No partner apps have been approved for the catalogue yet.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {catalogue.map((app) => {
          const appId = idOf(app);
          const installation = installationByApp.get(appId) || null;
          const actionBusy = busyId === appId || busyId === idOf(installation);
          const requiredEntitlements = Array.isArray(app.requiredEntitlements)
            ? app.requiredEntitlements
            : [];
          const scopes = Array.isArray(app.approvedScopes) ? app.approvedScopes : [];

          return (
            <article
              key={appId}
              className="rounded-2xl border border-black/10 bg-stone-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    {app.partnerName}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-black">{app.name}</h3>
                </div>
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">
                  Platform approved
                </span>
              </div>

              {app.description ? (
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {app.description}
                </p>
              ) : null}

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-stone-700">Commercial terms</dt>
                  <dd className="mt-1 text-stone-600">{commercialSummary(app)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-700">Billing authority</dt>
                  <dd className="mt-1 text-stone-600">Not enabled</dd>
                </div>
              </dl>

              {scopes.length ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                    Approved scopes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-stone-700"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {requiredEntitlements.length ? (
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  Required tenant entitlements: {requiredEntitlements.join(", ")}.
                </p>
              ) : null}

              <InstallationEvidence installation={installation} />

              <div className="mt-4 flex flex-wrap gap-2">
                {!installation ? (
                  <button
                    type="button"
                    onClick={() => prepare(app)}
                    disabled={!canManage || actionBusy}
                    className="inline-flex items-center gap-2 rounded-xl border border-black bg-amber-400 px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlugZap size={16} /> Prepare installation
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => reconcile(installation)}
                    disabled={!canManage || actionBusy}
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={16} /> Check canonical connection
                  </button>
                )}
              </div>

              <p className="mt-3 text-xs leading-5 text-stone-500">
                Preparing an app creates or synchronises a draft tenant IntegrationApp
                only. Credential issuance, OAuth/provider connection and activation are
                separate Integration Platform steps.
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
