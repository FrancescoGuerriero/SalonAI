import { BarChart3, BrainCircuit, Database, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import API from "../api/axios.js";

function formatValue(metric) {
  const value = Number(metric?.value || 0);
  if (metric?.unit === "GBP") {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
  }
  if (metric?.unit === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

function errorMessage(error) {
  return error?.response?.data?.message || error?.message || "Management BI could not be loaded.";
}

function Trend({ metric }) {
  const value = metric?.percentChange;
  if (value === null || value === undefined) return <span className="text-xs text-slate-500">New baseline</span>;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : BarChart3;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600"><Icon size={13} /> {Math.abs(value).toFixed(1)}% vs previous period</span>;
}

export default function PremiumAnalyticsPage() {
  const [periodDays, setPeriodDays] = useState(30);
  const [snapshot, setSnapshot] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [invocationId, setInvocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setAnalysis(null);
    setInvocationId("");
    try {
      const response = await API.get("/premium-analytics/management", { params: { periodDays } });
      setSnapshot(response.data?.snapshot || null);
    } catch (requestError) {
      setSnapshot(null);
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function analyse() {
    setAnalysisLoading(true);
    setError("");
    try {
      const response = await API.post("/premium-analytics/management/python-analysis", { periodDays });
      setSnapshot(response.data?.snapshot || snapshot);
      setAnalysis(response.data?.analysis || null);
      setInvocationId(String(response.data?.invocationId || ""));
    } catch (requestError) {
      setAnalysis(null);
      setInvocationId("");
      setError(errorMessage(requestError));
    } finally {
      setAnalysisLoading(false);
    }
  }

  useEffect(() => { void load(); }, [periodDays]);

  return (
    <main className="space-y-6 p-4 md:p-6" data-point10-bi="management-v1">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Point 10 · Original Phase 12</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Business Intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Canonical management KPIs calculated by the Node authority layer from location-owned operational facts. Python may interpret governed evidence, but it does not recalculate these source-of-truth metrics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>365 days</option>
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button>
          <button type="button" onClick={() => void analyse()} disabled={analysisLoading || !snapshot?.pythonAnalysis?.available} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><BrainCircuit size={15} /> {analysisLoading ? "Analysing…" : "Analyse with Python"}</button>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div> : null}

      {snapshot ? <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {(snapshot.metrics || []).map((metric) => <article key={metric.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{formatValue(metric)}</p><div className="mt-2"><Trend metric={metric} /></div><p className="mt-3 text-[11px] text-slate-400">Metric definition v{metric.version}</p></article>)}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-violet-600" /><h2 className="font-bold text-slate-900">Authority scope</h2></div><p className="mt-3 text-sm text-slate-700">{snapshot.authority?.scopeMode}</p><p className="mt-1 text-xs text-slate-500">{snapshot.authority?.locationIds?.length || 0} authorised location(s)</p><p className="mt-3 text-xs leading-5 text-slate-500">Location-owned facts only. Ambiguous legacy records without a Location are excluded.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Database size={18} className="text-violet-600" /><h2 className="font-bold text-slate-900">Evidence</h2></div><p className="mt-3 break-all text-xs font-semibold text-slate-700">{snapshot.evidence?.evidenceId}</p><p className="mt-2 text-xs text-slate-500">{snapshot.evidence?.recordsMatched || 0} canonical Appointment records matched.</p><p className="mt-1 text-xs text-slate-500">Customer PII included: no</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><BarChart3 size={18} className="text-violet-600" /><h2 className="font-bold text-slate-900">Python analysis boundary</h2></div><p className="mt-3 text-sm font-semibold text-slate-800">{snapshot.pythonAnalysis?.mode}</p><p className="mt-2 text-xs leading-5 text-slate-500">{snapshot.pythonAnalysis?.reason}</p><p className="mt-2 text-xs font-semibold text-slate-500">Model inference authorised: no · External write authorised: no</p></article>
        </section>

        {analysis ? <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5" data-point10-python-analysis="governed"><div className="flex items-center gap-2"><BrainCircuit size={18} className="text-violet-700" /><h2 className="font-bold text-violet-950">Governed Python statistical analysis</h2></div><p className="mt-2 text-xs text-violet-800">Deterministic baseline · model inference: no · external action: no</p><div className="mt-4 grid gap-3 md:grid-cols-2">{(analysis.observations || []).map((item) => <article key={item.metric_key} className="rounded-xl border border-violet-100 bg-white p-3"><p className="text-sm font-bold text-slate-900">{item.message}</p><p className="mt-1 text-xs text-slate-500">Material movement: {item.material ? "yes" : "no"}</p></article>)}</div>{invocationId ? <p className="mt-4 break-all text-[11px] font-semibold text-violet-700">Audited invocation: {invocationId}</p> : null}</section> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Metric provenance</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(snapshot.definitions || []).map((definition) => <article key={definition.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-bold text-slate-900">{definition.label}</p><p className="mt-1 text-xs text-slate-500">{definition.evidence?.sourceModel || "Canonical source"}</p>{definition.formula ? <p className="mt-2 text-xs font-mono text-slate-600">{definition.formula}</p> : null}</article>)}</div></section>
      </> : !loading && !error ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No management BI snapshot is available.</div> : null}
    </main>
  );
}
