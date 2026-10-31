import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Code2,
  Database,
  History,
  KeyRound,
  Layers3,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import API from "../api/axios.js";
import useFeatureControls from "../hooks/useFeatureControls.js";
import {
  getSystemObservabilityOverview,
} from "../Services/systemObservabilityService.js";

const TABS = [
  ["features", "On/Off Ideas", SlidersHorizontal],
  ["configuration", "Configuration Studio", Layers3],
  ["settings", "Stored settings", Code2],
  ["health", "System health", Activity],
  ["social-auth", "Sign-in providers", KeyRound],
];

const HEALTH_STYLES = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  degraded: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  disconnected: "border-stone-300 bg-stone-100 text-stone-700",
  unknown: "border-stone-200 bg-white text-stone-600",
};

function flattenConfiguration(value, prefix = "", items = []) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      flattenConfiguration(
        nestedValue,
        prefix ? `${prefix}.${key}` : key,
        items
      );
    });
    return items;
  }

  if (prefix) items.push({ key: prefix, value });
  return items;
}

function displayConfigurationValue(value) {
  if (value === null) return "Disabled";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "On" : "Off";
  return JSON.stringify(value);
}

function formatDate(value) {
  if (!value) return "No evidence";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "No evidence" : parsed.toLocaleString();
}

function Toggle({ checked, disabled, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-12 shrink-0 rounded-full border border-black/15 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
        checked ? "bg-amber-400" : "bg-stone-300"
      } ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}
    >
      <span
        className={`absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function HealthMetric({ label, value, icon: Icon, detail }) {
  return (
    <article className="rounded-xl border border-black/10 bg-stone-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-black">{value}</p>
        </div>
        <Icon size={20} className="text-amber-700" />
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-600">{detail}</p>
    </article>
  );
}

export default function SystemAdministrationPage() {
  const [tab, setTab] = useState("features");
  const [health, setHealth] = useState(null);
  const [observability, setObservability] = useState(null);
  const [settings, setSettings] = useState([]);
  const [features, setFeatures] = useState([]);
  const [configurationStudio, setConfigurationStudio] = useState(null);
  const [configurationSearch, setConfigurationSearch] = useState("");
  const [socialAuth, setSocialAuth] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { refreshFeatures } = useFeatureControls();

  const load = useCallback(async () => {
    setError("");

    try {
      const [
        healthResponse,
        settingsResponse,
        featuresResponse,
        configurationResponse,
        socialAuthResponse,
        observabilityResponse,
      ] = await Promise.all([
        API.get("/health/dependencies"),
        API.get("/system-administration/settings"),
        API.get("/system-administration/features"),
        API.get("/system-administration/configuration-studio").catch(() => ({
          data: { configurationStudio: null },
        })),
        API.get("/system-administration/social-auth-readiness").catch(() => ({
          data: { socialAuth: null },
        })),
        getSystemObservabilityOverview().catch(() => null),
      ]);

      setHealth(healthResponse.data);
      setSettings(settingsResponse.data.settings || []);
      setFeatures(featuresResponse.data.features || []);
      setConfigurationStudio(configurationResponse.data.configurationStudio || null);
      setSocialAuth(socialAuthResponse.data.socialAuth || null);
      setObservability(observabilityResponse);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(
    () => [...new Set(features.map(({ category }) => category))],
    [features]
  );

  const configurationRows = useMemo(() => {
    const query = configurationSearch.trim().toLowerCase();
    const rows = flattenConfiguration(configurationStudio?.effective || {});
    if (!query) return rows;
    return rows.filter(({ key, value }) =>
      `${key} ${displayConfigurationValue(value)}`.toLowerCase().includes(query)
    );
  }, [configurationSearch, configurationStudio]);

  const connectorSummary = observability?.connectorSummary || {};
  const attentionCount =
    Number(connectorSummary.degraded || 0) +
    Number(connectorSummary.error || 0) +
    Number(connectorSummary.disconnected || 0);

  async function changeFeature(feature, enabled) {
    setBusyId(feature.id);
    setError("");
    setNotice("");
    try {
      const response = await API.patch(
        `/system-administration/features/${feature.id}`,
        { enabled }
      );
      setFeatures((current) =>
        current.map((item) => item.id === feature.id ? response.data.feature : item)
      );
      await Promise.all([refreshFeatures(), load()]);
      setNotice(`${feature.label} is now ${enabled ? "on" : "off"}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "The feature could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  async function resetFeature(feature) {
    setBusyId(feature.id);
    setError("");
    setNotice("");
    try {
      const response = await API.delete(
        `/system-administration/features/${feature.id}`
      );
      setFeatures((current) =>
        current.map((item) => item.id === feature.id ? response.data.feature : item)
      );
      await Promise.all([refreshFeatures(), load()]);
      setNotice(`${feature.label} now follows its code default.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "The feature could not be reset.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-black">
                <ShieldCheck className="text-amber-600" size={20} /> Administrator-owned selections
              </div>
              <h1 className="mt-2 text-3xl font-bold text-black">System Administration</h1>
              <p className="mt-2 max-w-3xl text-sm text-stone-600">
                Manage safe platform controls and inspect tenant-scoped configuration, provider readiness and operational health evidence.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 font-semibold text-black shadow-sm transition hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              <RefreshCw size={18} /> Refresh
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="System administration sections">
            {TABS.map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                  tab === id
                    ? "border-black bg-amber-400 text-black shadow-sm"
                    : "border-black/10 bg-stone-100 text-black hover:bg-amber-100"
                }`}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-amber-500 bg-amber-50 p-4 text-black" role="alert">
            {error}
          </section>
        ) : null}
        {notice ? (
          <section className="rounded-2xl border border-black/15 bg-white p-4 text-black shadow-sm" role="status">
            {notice}
          </section>
        ) : null}

        {tab === "features" ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Feature group</p>
                    <h2 className="mt-1 text-xl font-bold text-black">{group}</h2>
                  </div>
                  <span className="rounded-full border border-black/10 bg-stone-100 px-3 py-1 text-xs font-semibold text-black">
                    {features.filter((item) => item.category === group && item.enabled).length} on
                  </span>
                </div>

                <div className="mt-4 divide-y divide-stone-200">
                  {features.filter((item) => item.category === group).map((feature) => (
                    <article key={feature.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-black">{feature.label}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            feature.source === "admin"
                              ? "border-amber-500 bg-amber-50 text-black"
                              : "border-black/10 bg-stone-100 text-stone-700"
                          }`}>
                            {feature.required ? "required" : feature.source === "admin" ? "admin override" : "code default"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-600">{feature.description}</p>
                        {feature.enforcement ? (
                          <p className="mt-2 text-xs leading-5 text-stone-500">
                            <strong className="text-stone-700">OFF means:</strong> {feature.enforcement}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        {feature.source === "admin" ? (
                          <button
                            type="button"
                            onClick={() => resetFeature(feature)}
                            disabled={busyId === feature.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-stone-100 disabled:opacity-50"
                          >
                            <RotateCcw size={14} /> Reset to code
                          </button>
                        ) : null}
                        <span className="min-w-7 text-sm font-bold text-black">{feature.enabled ? "On" : "Off"}</span>
                        <Toggle
                          checked={feature.enabled}
                          disabled={feature.required || busyId === feature.id}
                          label={`${feature.enabled ? "Disable" : "Enable"} ${feature.label}`}
                          onChange={(enabled) => changeFeature(feature, enabled)}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {tab === "configuration" ? (
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers3 className="text-amber-600" size={20} />
                  <h2 className="text-xl font-bold text-black">Configuration Studio</h2>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                  View the effective configuration for the active business and its platform, vertical, business or location provenance.
                </p>
              </div>
              {configurationStudio?.business ? (
                <div className="rounded-xl border border-black/10 bg-stone-50 px-4 py-3 text-sm">
                  <p className="font-bold text-black">{configurationStudio.business.name}</p>
                  <p className="mt-1 text-stone-600">{configurationStudio.location?.name || "Business-wide configuration"}</p>
                </div>
              ) : null}
            </div>

            {configurationStudio ? (
              <>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(configurationStudio.scopeChain || []).map((scope) => (
                    <span key={`${scope.scopeType}:${scope.scopeKey}`} className="rounded-full border border-black/10 bg-stone-100 px-3 py-1 text-xs font-semibold text-black">
                      {scope.scope}
                    </span>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-black">
                  Existing SystemSetting controls remain authoritative while scoped configuration is introduced. No automatic migration is running.
                </div>
                <label className="mt-5 block max-w-xl">
                  <span className="text-sm font-semibold text-black">Find a configuration value</span>
                  <span className="mt-2 flex items-center gap-2 rounded-xl border border-black/15 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-500">
                    <Search size={17} className="text-stone-500" />
                    <input
                      type="search"
                      value={configurationSearch}
                      onChange={(event) => setConfigurationSearch(event.target.value)}
                      placeholder="Search booking, AI, membership..."
                      className="w-full border-0 bg-transparent text-sm text-black outline-none placeholder:text-stone-400"
                    />
                  </span>
                </label>
                <div className="mt-5 overflow-hidden rounded-xl border border-black/10">
                  {configurationRows.length ? configurationRows.map(({ key, value }) => (
                    <article key={key} className="grid gap-3 border-b border-stone-200 bg-white p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                      <p className="font-mono text-sm font-semibold text-black">{key}</p>
                      <p className="break-words text-sm font-semibold text-black">{displayConfigurationValue(value)}</p>
                      <span className="w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-black">
                        {configurationStudio.provenanceDetails?.[key]?.scope || configurationStudio.provenance?.[key] || "default"}
                      </span>
                    </article>
                  )) : (
                    <div className="bg-stone-50 p-6 text-sm text-stone-600">No effective configuration values match this view.</div>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-black">
                Configuration Studio could not resolve the active business context. The rest of System Administration remains available.
              </p>
            )}
          </section>
        ) : null}

        {tab === "settings" ? (
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <History className="text-amber-600" />
              <h2 className="font-semibold text-black">Stored settings</h2>
            </div>
            <div className="mt-4 divide-y divide-stone-200">
              {settings.map((setting) => (
                <div key={setting._id} className="py-3">
                  <p className="font-medium text-black">{setting.key}</p>
                  <p className="text-sm text-stone-600">{String(setting.value)} · {setting.category}</p>
                </div>
              ))}
              {!settings.length ? (
                <p className="py-6 text-sm text-stone-600">No stored overrides are present. Code defaults remain active.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "health" ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Activity className="text-amber-600" />
                <div>
                  <h2 className="font-semibold text-black">Observability & Health</h2>
                  <p className="mt-1 text-sm text-stone-600">Read-only tenant health evidence. No provider secrets, cross-tenant telemetry or operational write actions are exposed here.</p>
                </div>
              </div>

              {observability ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <HealthMetric label="Connector records" value={connectorSummary.total || 0} icon={PlugZap} detail={`${connectorSummary.healthy || 0} healthy`} />
                    <HealthMetric label="Needs attention" value={attentionCount} icon={AlertTriangle} detail="Degraded, error or disconnected connector evidence" />
                    <HealthMetric label="AI datasets" value={observability.ai?.datasetCount || 0} icon={Database} detail={`${observability.ai?.frozenDatasetCount || 0} frozen governed datasets`} />
                    <HealthMetric label="AI candidates" value={observability.ai?.candidateModelCount || 0} icon={Bot} detail={`${observability.ai?.approvedModelCount || 0} approved model records`} />
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {(observability.connectors || []).map((connector) => {
                      const status = HEALTH_STYLES[connector.status] ? connector.status : "unknown";
                      return (
                        <article key={connector.id} className="rounded-xl border border-black/10 bg-stone-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-black">{connector.componentKey}</h3>
                              <p className="mt-1 text-xs text-stone-500">Last success: {formatDate(connector.lastSuccessAt)}</p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${HEALTH_STYLES[status]}`}>{status}</span>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-stone-600">
                            <div><dt className="font-bold">Latency</dt><dd>{connector.latencyMs === null ? "No evidence" : `${connector.latencyMs} ms`}</dd></div>
                            <div><dt className="font-bold">Last failure</dt><dd>{formatDate(connector.lastFailureAt)}</dd></div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>

                  {!(observability.connectors || []).length ? (
                    <p className="mt-5 rounded-xl border border-dashed border-black/20 bg-stone-50 p-4 text-sm text-stone-600">No tenant-scoped connector health records are currently available.</p>
                  ) : null}

                  <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <p className="font-bold">AI governance safety</p>
                      <p className="mt-2 leading-6">Production training: {observability.ai?.productionTrainingEnabled ? "Enabled" : "Disabled"}. Automatic promotion: {observability.ai?.automaticPromotionEnabled ? "Enabled" : "Disabled"}. Automatic inference activation: {observability.ai?.automaticInferenceActivationEnabled ? "Enabled" : "Disabled"}.</p>
                    </article>
                    <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-bold">Background jobs</p>
                      <p className="mt-2 leading-6">{observability.backgroundJobs?.reason}</p>
                    </article>
                    <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-bold">Dead letters</p>
                      <p className="mt-2 leading-6">{observability.deadLetters?.reason}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide">0 tenant records exposed</p>
                    </article>
                  </div>
                </>
              ) : (
                <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-black">Tenant-scoped observability evidence is unavailable. No health state is inferred.</p>
              )}
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-black">Core dependency health</h2>
              <pre className="mt-3 overflow-auto rounded-xl bg-black p-4 text-xs text-white">{JSON.stringify(health, null, 2)}</pre>
            </section>
          </div>
        ) : null}

        {tab === "social-auth" ? (
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="text-amber-600" size={20} />
                  <h2 className="font-semibold text-black">Customer social sign-in</h2>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                  Configuration status only. Client secrets are never returned to the browser.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
                socialAuth?.readyForAcceptance
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-amber-300 bg-amber-50 text-black"
              }`}>
                {socialAuth?.readyForAcceptance ? "Ready for provider acceptance" : "Provider setup required"}
              </span>
            </div>

            {socialAuth ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {(socialAuth.providers || []).map((provider) => (
                  <article key={provider.provider} className="rounded-xl border border-black/10 bg-stone-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-black">{provider.label}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                        provider.ready
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-amber-300 bg-amber-50 text-black"
                      }`}>
                        {provider.ready ? "Configured" : "Setup required"}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div>
                        <dt className="font-semibold text-stone-700">Callback path</dt>
                        <dd className="mt-1 break-all font-mono text-xs text-stone-600">{provider.redirect?.expectedPath}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-stone-700">Callback to register</dt>
                        <dd className="mt-1 break-all font-mono text-xs text-stone-600">{window.location.origin}{provider.redirect?.expectedPath}</dd>
                      </div>
                    </dl>
                    {!provider.ready && provider.blockers?.length ? (
                      <ul className="mt-4 space-y-1 text-sm text-stone-700">
                        {provider.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-black">Social-auth readiness could not be loaded.</p>
            )}

            {socialAuth?.nextSteps?.length ? (
              <div className="mt-5 rounded-xl border border-black/10 bg-white p-4">
                <h3 className="font-semibold text-black">Next steps</h3>
                <ol className="mt-2 space-y-2 text-sm leading-6 text-stone-600">
                  {socialAuth.nextSteps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
