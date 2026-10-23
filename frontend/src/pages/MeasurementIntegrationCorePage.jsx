import {
  Activity,
  BarChart3,
  Database,
  Globe2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import API from "../api/axios.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

const initialSource = {
  app: "",
  name: "",
  provider: "ga4",
  syncMode: "manual",
  cadence: "manual",
  rootUrl: "",
};

function providerLabel(provider, catalogue) {
  return catalogue?.connectors?.find((item) => item.key === provider)?.label || provider;
}

export default function MeasurementIntegrationCorePage() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "feature-control:update");
  const [contract, setContract] = useState(null);
  const [overview, setOverview] = useState(null);
  const [apps, setApps] = useState([]);
  const [health, setHealth] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [sourceForm, setSourceForm] = useState(initialSource);
  const [selectedSource, setSelectedSource] = useState("");
  const [sampleJson, setSampleJson] = useState('[\n  {"date":"2026-10-23","clicks":12,"impressions":180}\n]');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const [contractResponse, overviewResponse, appsResponse, healthResponse, deliveryResponse] = await Promise.all([
        API.get("/integration-platform/stage-5-contract"),
        API.get("/integration-platform/marketing-data/overview"),
        API.get("/integration-platform/apps"),
        API.get("/integration-platform/health"),
        API.get("/integration-platform/webhook-deliveries").catch(() => ({ data: { items: [] } })),
      ]);
      setContract(contractResponse.data);
      setOverview(overviewResponse.data);
      setApps(appsResponse.data.items || []);
      setHealth(healthResponse.data.items || []);
      setDeliveries(deliveryResponse.data.items || []);
      if (!sourceForm.app && appsResponse.data.items?.length) {
        setSourceForm((current) => ({ ...current, app: appsResponse.data.items[0]._id }));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Stage 5 measurement data could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, []);

  const sources = overview?.sources || [];
  const runs = overview?.recentRuns || [];
  const metricVersions = useMemo(
    () => [...new Set((contract?.metrics || []).map((item) => item.version).filter(Boolean))],
    [contract]
  );

  async function createSource(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await API.post("/integration-platform/marketing-data/sources", {
        app: sourceForm.app,
        name: sourceForm.name,
        provider: sourceForm.provider,
        syncMode: sourceForm.syncMode,
        schedule: { cadence: sourceForm.cadence, timezone: "Europe/London" },
        sourceConfig: sourceForm.provider === "technical_seo" && sourceForm.rootUrl
          ? { rootUrl: sourceForm.rootUrl, maxPages: 25 }
          : {},
      });
      setSourceForm((current) => ({ ...initialSource, app: current.app }));
      setNotice("Marketing data source created. Credentials remain governed by the Integration App control plane.");
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "The data source could not be created.");
    } finally { setBusy(false); }
  }

  function parsedSamples() {
    let value;
    try { value = JSON.parse(sampleJson); }
    catch { throw new Error("Sample data must be valid JSON."); }
    return Array.isArray(value) ? value : [value];
  }

  async function previewSource() {
    setBusy(true); setError(""); setNotice(""); setPreview(null);
    try {
      const records = parsedSamples();
      const response = await API.post(`/integration-platform/marketing-data/sources/${selectedSource}/preview`, { records });
      setPreview(response.data);
      setNotice("Preview completed without writing raw or normalised records.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Preview failed.");
    } finally { setBusy(false); }
  }

  async function runSource(source) {
    setBusy(true); setError(""); setNotice("");
    try {
      const body = source.provider === "technical_seo"
        ? { mode: "seo_scan" }
        : { mode: source.syncMode || "manual", records: selectedSource === source._id ? parsedSamples() : [] };
      await API.post(`/integration-platform/marketing-data/sources/${source._id}/runs`, body);
      setNotice(source.provider === "technical_seo" ? "Bounded technical SEO scan completed." : "Source-level ingestion run completed.");
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Source run failed.");
    } finally { setBusy(false); }
  }

  const connectorCatalogue = contract?.marketing || overview?.catalogue;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Stage 5 · SEO, measurement & integration core</p>
              <h1 className="mt-2 text-3xl font-bold text-black">Measurement & Integration Core</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
                Inspect versioned integration contracts, connector health, webhooks, canonical metrics and the Marketing Data Core. Live Google/Bing credentials remain in Integration App credential management; this workspace never accepts provider secrets.
              </p>
            </div>
            <button type="button" onClick={load} className="app-button app-button-secondary"><RefreshCw size={17}/>Refresh</button>
          </div>
        </section>

        {error ? <section className="rounded-2xl border border-amber-500 bg-amber-50 p-4 text-black" role="alert">{error}</section> : null}
        {notice ? <section className="rounded-2xl border border-black/10 bg-white p-4 text-black" role="status">{notice}</section> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><ShieldCheck/><small className="mt-3 block text-stone-500">Stage-5 contract</small><strong className="text-xl">v{contract?.contractVersion || "—"}</strong></div>
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><Activity/><small className="mt-3 block text-stone-500">Rate-limit contract</small><strong className="text-xl">v{contract?.rateLimit?.version || "—"}</strong></div>
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><BarChart3/><small className="mt-3 block text-stone-500">Metric definitions</small><strong className="text-xl">{contract?.metrics?.length || 0} · {metricVersions.join(", ") || "—"}</strong></div>
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><Webhook/><small className="mt-3 block text-stone-500">Event schemas</small><strong className="text-xl">{contract?.events?.length || 0}</strong></div>
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"><Database/><small className="mt-3 block text-stone-500">Marketing sources</small><strong className="text-xl">{overview?.summary?.sources || 0}</strong></div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
          <form onSubmit={createSource} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Plus className="text-amber-600"/><h2 className="text-xl font-bold">No-code source onboarding</h2></div>
            <p className="mt-2 text-sm text-stone-600">Configure source metadata and field contracts without storing secrets in the source record.</p>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold">Integration App<select required disabled={!canManage || busy} className="mt-1 w-full rounded-xl border border-black/15 p-2.5" value={sourceForm.app} onChange={(e)=>setSourceForm({...sourceForm,app:e.target.value})}><option value="">Select app</option>{apps.map((app)=><option key={app._id} value={app._id}>{app.name} · {app.environment}</option>)}</select></label>
              <label className="block text-sm font-semibold">Provider<select disabled={!canManage || busy} className="mt-1 w-full rounded-xl border border-black/15 p-2.5" value={sourceForm.provider} onChange={(e)=>setSourceForm({...sourceForm,provider:e.target.value})}>{(connectorCatalogue?.connectors || []).map((item)=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
              <label className="block text-sm font-semibold">Source name<input required disabled={!canManage || busy} className="mt-1 w-full rounded-xl border border-black/15 p-2.5" value={sourceForm.name} onChange={(e)=>setSourceForm({...sourceForm,name:e.target.value})}/></label>
              <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Sync mode<select disabled={!canManage || busy} className="mt-1 w-full rounded-xl border border-black/15 p-2.5" value={sourceForm.syncMode} onChange={(e)=>setSourceForm({...sourceForm,syncMode:e.target.value})}><option value="manual">Manual</option><option value="scheduled">Scheduled</option><option value="incremental">Incremental</option></select></label><label className="block text-sm font-semibold">Cadence<select disabled={!canManage || busy} className="mt-1 w-full rounded-xl border border-black/15 p-2.5" value={sourceForm.cadence} onChange={(e)=>setSourceForm({...sourceForm,cadence:e.target.value})}><option value="manual">Manual</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label></div>
              {sourceForm.provider === "technical_seo" ? <label className="block text-sm font-semibold">HTTPS site root<input required type="url" disabled={!canManage || busy} placeholder="https://example.com/" className="mt-1 w-full rounded-xl border border-black/15 p-2.5" value={sourceForm.rootUrl} onChange={(e)=>setSourceForm({...sourceForm,rootUrl:e.target.value})}/></label> : null}
              <button disabled={!canManage || busy || !sourceForm.app} className="app-button app-button-primary"><Plus size={17}/>Create source</button>
            </div>
          </form>

          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Database className="text-amber-600"/><h2 className="text-xl font-bold">Sources & connector health</h2></div>
            <div className="mt-4 divide-y divide-stone-200">
              {sources.length ? sources.map((source) => {
                const sourceHealth = health.find((item) => item.componentKey === `marketing-source:${source._id}`);
                return <article key={source._id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"><div><small className="text-stone-500">{providerLabel(source.provider, connectorCatalogue)} · {source.syncMode} · schema {source.providerSchemaVersion}</small><h3 className="font-bold">{source.name}</h3><p className="text-sm text-stone-600">{source.fieldCatalogue?.length || 0} fields · source {source.status} · health {sourceHealth?.status || "unknown"}</p>{source.lastError ? <p className="text-sm text-amber-700">{source.lastError}</p> : null}</div><div className="flex flex-wrap gap-2"><button type="button" className="app-button app-button-secondary app-button-sm" onClick={()=>setSelectedSource(source._id)}>Use sample</button><button type="button" disabled={!canManage||busy||(source.provider!=="technical_seo"&&selectedSource!==source._id)} className="app-button app-button-primary app-button-sm" onClick={()=>runSource(source)}><Play size={15}/>{source.provider === "technical_seo" ? "Scan" : "Run sample"}</button></div></article>;
              }) : <p className="py-5 text-sm text-stone-500">No Marketing Data Core sources have been configured.</p>}
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Globe2 className="text-amber-600"/><h2 className="text-xl font-bold">Data preview & reconciliation</h2></div>
          <p className="mt-2 text-sm text-stone-600">Select a non-SEO source, paste representative provider output, preview the mapping, then optionally run the same sample through raw → normalised lineage.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2"><div><select className="w-full rounded-xl border border-black/15 p-2.5" value={selectedSource} onChange={(e)=>setSelectedSource(e.target.value)}><option value="">Select source</option>{sources.filter((source)=>source.provider!=="technical_seo").map((source)=><option key={source._id} value={source._id}>{source.name}</option>)}</select><textarea rows="10" className="mt-3 w-full rounded-xl border border-black/15 p-3 font-mono text-xs" value={sampleJson} onChange={(e)=>setSampleJson(e.target.value)}/><button type="button" disabled={!canManage||busy||!selectedSource} onClick={previewSource} className="app-button app-button-secondary mt-3">Preview mapping</button></div><pre className="max-h-80 overflow-auto rounded-xl bg-stone-950 p-4 text-xs text-stone-100">{preview ? JSON.stringify(preview, null, 2) : "Preview output will appear here."}</pre></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h2 className="font-bold">Recent sync runs</h2><div className="mt-3 divide-y divide-stone-200">{runs.slice(0,10).map((run)=><div key={run._id} className="py-3 text-sm"><strong>{run.source?.name || "Source"}</strong><p className="text-stone-600">{run.mode} · {run.status} · fetched {run.counters?.fetched || 0} · normalised {run.counters?.normalised || 0} · reconciled {run.counters?.reconciled || 0}</p></div>)}</div></div>
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><h2 className="font-bold">Webhook observability</h2><p className="mt-2 text-sm text-stone-600">{deliveries.length} recent deliveries returned by the existing webhook platform.</p><div className="mt-3 divide-y divide-stone-200">{deliveries.slice(0,8).map((item)=><div key={item._id} className="py-3 text-sm"><strong>{item.eventType || item.event?.type || "Webhook delivery"}</strong><p className="text-stone-600">{item.status || "unknown"} · attempt {item.attempts || item.attempt || 0}</p></div>)}</div></div>
        </section>
      </div>
    </main>
  );
}
