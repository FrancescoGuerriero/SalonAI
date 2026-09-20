import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Code2,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import API from "../api/axios.js";
import useFeatureControls from "../hooks/useFeatureControls.js";
import useAuth from "../hooks/useAuth.js";
import { isSuperAdminRole } from "../utils/roles.js";

const TABS = [
  ["features", "On/Off Ideas", SlidersHorizontal],
  ["settings", "Stored settings", Code2],
  ["health", "System health", Activity],
];

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

export default function SystemAdministrationPage() {
  const { user } = useAuth();
  const canMutateSystemControls = isSuperAdminRole(user?.role);
  const [tab, setTab] = useState("features");
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState([]);
  const [features, setFeatures] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { refreshFeatures } = useFeatureControls();

  const load = useCallback(async () => {
    setError("");

    try {
      const [healthResponse, settingsResponse, featuresResponse] = await Promise.all([
        API.get("/health/dependencies"),
        API.get("/system-administration/settings"),
        API.get("/system-administration/features"),
      ]);

      setHealth(healthResponse.data);
      setSettings(settingsResponse.data.settings || []);
      setFeatures(featuresResponse.data.features || []);
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
                Code defines safe defaults. Super Admin and Administrator can inspect this workspace. Global feature and setting changes remain protected Super Admin actions and are recorded in the audit history.
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
        {!canMutateSystemControls ? (
          <section className="rounded-2xl border border-black/15 bg-stone-100 p-4 text-sm text-black" role="status">
            Administrator view is read-only. Super Admin authority is required to change global feature controls or stored settings.
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

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-black/10 bg-stone-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-stone-700">
                            {feature.controlMode === "workspace"
                              ? "Workspace visibility"
                              : feature.controlMode === "required"
                                ? "Required control"
                                : "Real capability"}
                          </span>

                          {(feature.impactScopes || []).map((scope) => (
                            <span
                              key={scope}
                              className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-black"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>

                        {feature.enforcement ? (
                          <p className="mt-2 text-xs leading-5 text-stone-500">
                            <strong className="text-stone-700">OFF means:</strong>{" "}
                            {feature.enforcement}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        {feature.source === "admin" ? (
                          <button
                            type="button"
                            onClick={() => resetFeature(feature)}
                            disabled={!canMutateSystemControls || busyId === feature.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-stone-100 disabled:opacity-50"
                          >
                            <RotateCcw size={14} /> Reset to code
                          </button>
                        ) : null}
                        <span className="min-w-7 text-sm font-bold text-black">{feature.enabled ? "On" : "Off"}</span>
                        <Toggle
                          checked={feature.enabled}
                          disabled={!canMutateSystemControls || feature.required || busyId === feature.id}
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
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <Activity className="text-amber-600" />
            <h2 className="mt-4 font-semibold text-black">Dependency health</h2>
            <pre className="mt-3 overflow-auto rounded-xl bg-black p-4 text-xs text-white">{JSON.stringify(health, null, 2)}</pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
