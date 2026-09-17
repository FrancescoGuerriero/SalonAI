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
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
        checked ? "bg-emerald-600" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`mt-1 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SystemAdministrationPage() {
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-700">
                <ShieldCheck size={20} /> Administrator-owned backend selections
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">System Administration</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Code defines safe defaults. The On/Off Ideas tab stores administrator overrides in MongoDB, applies backend enforcement and records every change in the audit history.
              </p>
            </div>

            <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold">
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
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>
        </section>

        {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800" role="alert">{error}</section> : null}
        {notice ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800" role="status">{notice}</section> : null}

        {tab === "features" ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Feature group</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{group}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {features.filter((item) => item.category === group && item.enabled).length} on
                  </span>
                </div>

                <div className="mt-4 divide-y divide-slate-100">
                  {features.filter((item) => item.category === group).map((feature) => (
                    <article key={feature.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{feature.label}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feature.source === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                            {feature.required ? "required" : feature.source === "admin" ? "admin override" : "code default"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {feature.source === "admin" ? (
                          <button
                            type="button"
                            onClick={() => resetFeature(feature)}
                            disabled={busyId === feature.id}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <RotateCcw size={14} /> Reset to code
                          </button>
                        ) : null}
                        <span className="min-w-7 text-sm font-bold text-slate-700">{feature.enabled ? "On" : "Off"}</span>
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

        {tab === "settings" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><History className="text-indigo-700" /><h2 className="font-semibold text-slate-900">Stored settings</h2></div>
            <div className="mt-4 divide-y divide-slate-100">
              {settings.map((setting) => (
                <div key={setting._id} className="py-3">
                  <p className="font-medium text-slate-900">{setting.key}</p>
                  <p className="text-sm text-slate-500">{String(setting.value)} · {setting.category}</p>
                </div>
              ))}
              {!settings.length ? <p className="py-6 text-sm text-slate-500">No stored overrides are present. Code defaults remain active.</p> : null}
            </div>
          </section>
        ) : null}

        {tab === "health" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Activity className="text-indigo-700" />
            <h2 className="mt-4 font-semibold text-slate-900">Dependency health</h2>
            <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(health, null, 2)}</pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
