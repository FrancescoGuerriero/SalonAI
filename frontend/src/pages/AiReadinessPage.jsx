import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Database,
  Eye,
  Fingerprint,
  History,
  Lightbulb,
  Loader2,
  MapPin,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getAiGatewayEvidence,
  listAiGatewayInvocations,
  listSavedViews,
  planAiGateway,
  previewAiAdvisory,
} from "../Services/dataHubService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

function errorMessage(error) {
  return error?.response?.data?.message || error?.response?.data?.code || error?.message || "The AI readiness request could not be completed.";
}

function shortId(value, length = 16) {
  const text = String(value || "");
  if (!text) return "—";
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function StatusBadge({ children, tone = "slate" }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function AdvisoryCard({ item, citationMap }) {
  const tone = item.category === "recommendation" ? "border-indigo-200 bg-indigo-50" : item.category === "constraint" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white";
  return (
    <article className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={item.category === "recommendation" ? "indigo" : item.category === "constraint" ? "amber" : "slate"}>{item.category}</StatusBadge>
        <StatusBadge tone={item.priority === "high" ? "rose" : item.priority === "medium" ? "amber" : "slate"}>{item.priority}</StatusBadge>
      </div>
      <h3 className="mt-3 font-bold text-slate-900">{item.title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">{item.message}</p>
      {item.citations?.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Evidence citations</p>
          {item.citations.map((citationId) => {
            const citation = citationMap.get(citationId);
            return (
              <div key={citationId} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <span className="font-mono font-bold text-slate-800">{citationId}</span>
                {citation ? ` · ${citation.fact_name} = ${String(citation.fact_value)} · evidence ${shortId(citation.evidence_id, 12)}` : ""}
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

export default function AiReadinessPage() {
  const { user } = useAuth();
  const canUseAi = hasPermission(user, "ai:use");
  const [savedViews, setSavedViews] = useState([]);
  const [invocations, setInvocations] = useState([]);
  const [viewId, setViewId] = useState("");
  const [requestedAction, setRequestedAction] = useState("analyse");
  const [evidence, setEvidence] = useState(null);
  const [plan, setPlan] = useState(null);
  const [advisory, setAdvisory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const evidencePayload = useMemo(() => {
    if (viewId) return { viewId };
    return {
      query: {
        sourceIds: [],
        dateRange: { rollingDays: 30 },
        dateGrain: "day",
        dimensions: ["provider"],
        metrics: [],
        calculatedMetrics: [],
        filters: [],
        rowLimit: 100,
      },
    };
  }, [viewId]);

  async function refreshAudit() {
    setInvocations(await listAiGatewayInvocations({ limit: 30 }));
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [views, audit] = await Promise.all([listSavedViews(), listAiGatewayInvocations({ limit: 30 })]);
      setSavedViews(views);
      setInvocations(audit);
      setViewId((current) => current || views[0]?._id || "");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetResults() {
    setEvidence(null);
    setPlan(null);
    setAdvisory(null);
  }

  async function previewEvidence() {
    setWorking("evidence");
    setError("");
    setPlan(null);
    setAdvisory(null);
    try {
      setEvidence(await getAiGatewayEvidence(evidencePayload));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  async function previewPlan() {
    setWorking("plan");
    setError("");
    setAdvisory(null);
    try {
      const result = await planAiGateway({ ...evidencePayload, toolKey: "marketing-insights", requestedAction });
      setPlan(result);
      setEvidence(result.evidence || evidence);
      await refreshAudit();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  async function generateAdvisory() {
    if (!canUseAi || requestedAction === "forecast") return;
    setWorking("advisory");
    setError("");
    try {
      const result = await previewAiAdvisory({ ...evidencePayload, toolKey: "marketing-insights", requestedAction });
      setAdvisory(result);
      setEvidence(result.evidence || evidence);
      await refreshAudit();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-8" id="main-content" tabIndex="-1"><Loader2 className="mx-auto mt-24 animate-spin text-indigo-600" size={32} /></main>;
  }

  const latest = invocations[0] || null;
  const providers = Array.from(new Set((evidence?.provenance || []).map((item) => item.provider).filter(Boolean)));
  const advisoryBody = advisory?.advisory || null;
  const citationMap = new Map((advisoryBody?.citations || []).map((item) => [item.id, item]));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><Sparkles size={18} /> Stage 8 · AI readiness</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Location AI readiness & advisory preview</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Inspect canonical evidence for the selected SALON AI location, validate an execution plan, and generate cited deterministic recommendations before any model inference is enabled.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/system/data-hub" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><ArrowLeft size={16} /> Data Hub</Link>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><RefreshCw size={16} /> Refresh</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3 text-sm leading-6 text-emerald-950">
            <ShieldCheck size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Governed advisory mode for the selected location.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge tone="indigo">Location-owned</StatusBadge>
                <StatusBadge tone="emerald">Cited deterministic baseline</StatusBadge>
                <StatusBadge tone="rose">Model inference disabled</StatusBadge>
                <StatusBadge tone="rose">External writes disabled</StatusBadge>
                <StatusBadge tone="amber">Human approval required</StatusBadge>
              </div>
            </div>
          </div>
        </section>

        {error ? <section role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</section> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><MapPin size={19} className="text-indigo-600" /><p className="mt-3 text-sm font-semibold text-slate-500">Location</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{shortId(evidence?.location_id || latest?.location, 24)}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Database size={19} className="text-indigo-600" /><p className="mt-3 text-2xl font-bold text-slate-900">{evidence?.facts?.length ?? latest?.factCount ?? 0}</p><p className="text-sm font-semibold text-slate-500">Canonical facts</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Fingerprint size={19} className="text-indigo-600" /><p className="mt-3 font-mono text-sm font-bold text-slate-900">{shortId(evidence?.evidence_id || latest?.evidenceId)}</p><p className="mt-1 text-sm font-semibold text-slate-500">Evidence ID</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><History size={19} className="text-indigo-600" /><p className="mt-3 text-2xl font-bold text-slate-900">{invocations.length}</p><p className="text-sm font-semibold text-slate-500">Recent AI governance events</p></article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Bot size={19} className="text-indigo-600" /><h2 className="text-xl font-bold text-slate-900">Evidence and advisory controls</h2></div>
            <p className="mt-1 text-sm text-slate-500">Current governed capability: Marketing Insights using canonical Data Hub evidence from this location.</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Evidence source
                <select value={viewId} onChange={(event) => { setViewId(event.target.value); resetResults(); }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Default 30-day location query</option>
                  {savedViews.map((view) => <option key={view._id} value={view._id}>{view.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Requested action
                <select value={requestedAction} onChange={(event) => { setRequestedAction(event.target.value); setPlan(null); setAdvisory(null); }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="analyse">Analyse</option>
                  <option value="summarise">Summarise</option>
                  <option value="recommend">Recommend</option>
                  <option value="forecast">Forecast — planning only</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => void previewEvidence()} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 disabled:opacity-50">{working === "evidence" ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Preview evidence</button>
              <button type="button" onClick={() => void previewPlan()} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">{working === "plan" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Validate plan</button>
              <button type="button" onClick={() => void generateAdvisory()} disabled={Boolean(working) || !canUseAi || requestedAction === "forecast"} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{working === "advisory" ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />} Generate advisory preview</button>
            </div>
            {!canUseAi ? <p className="mt-3 text-xs font-semibold text-amber-700">Your role can inspect readiness but does not have the `ai:use` permission required to generate an advisory.</p> : null}
            {requestedAction === "forecast" ? <p className="mt-3 text-xs font-semibold text-amber-700">Forecast execution remains disabled until a governed predictive model passes baseline-comparison and promotion gates.</p> : null}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Canonical evidence preview</h2>
            <p className="mt-1 text-sm text-slate-500">Evidence is generated from the active location only.</p>
            {evidence ? (
              <div className="mt-4 space-y-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Contract</dt><dd className="mt-1 font-bold text-slate-900">{evidence.contract}</dd></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Generated</dt><dd className="mt-1 font-bold text-slate-900">{formatTime(evidence.generated_at)}</dd></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Facts</dt><dd className="mt-1 font-bold text-slate-900">{evidence.facts?.length || 0}</dd></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Provenance</dt><dd className="mt-1 font-bold text-slate-900">{evidence.provenance?.length || 0}</dd></div>
                </dl>
                <div><p className="text-xs font-bold uppercase text-slate-500">Providers represented</p><div className="mt-2 flex flex-wrap gap-2">{providers.length ? providers.map((provider) => <StatusBadge key={provider} tone="indigo">{provider}</StatusBadge>) : <StatusBadge>No provider evidence yet</StatusBadge>}</div></div>
                <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify((evidence.facts || []).slice(0, 25), null, 2)}</pre>
              </div>
            ) : <div className="mt-8 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500"><Eye className="mx-auto mb-3 text-slate-300" size={34} />Preview evidence to inspect canonical facts and provenance.</div>}
          </article>
        </section>

        {plan ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3"><CheckCircle2 size={21} className="mt-0.5 text-emerald-600" /><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Planning validation recorded</p><h2 className="mt-1 text-xl font-bold text-slate-900">Capability and evidence contract accepted</h2><p className="mt-1 text-sm text-slate-600">{plan.message}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-2"><StatusBadge tone="rose">Execution disabled</StatusBadge><StatusBadge tone="rose">External writes disabled</StatusBadge><StatusBadge tone="amber">Human approval required</StatusBadge><StatusBadge>Invocation {shortId(plan.invocationId, 12)}</StatusBadge></div>
          </section>
        ) : null}

        {advisoryBody ? (
          <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3"><Lightbulb size={22} className="mt-0.5 text-indigo-600" /><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Cited advisory preview</p><h2 className="mt-1 text-xl font-bold text-slate-900">Operator review required</h2><p className="mt-1 text-sm leading-6 text-slate-600">{advisoryBody.message}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-2"><StatusBadge tone="emerald">Deterministic baseline</StatusBadge><StatusBadge tone="rose">Model inference: no</StatusBadge><StatusBadge tone="rose">External write: no</StatusBadge><StatusBadge tone="amber">Human approval required</StatusBadge><StatusBadge>Invocation {shortId(advisory.invocationId, 12)}</StatusBadge></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">{(advisoryBody.items || []).map((item) => <AdvisoryCard key={item.id} item={item} citationMap={citationMap} />)}</div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><History size={19} className="text-indigo-600" /><h2 className="text-xl font-bold text-slate-900">Location AI governance history</h2></div>
          <p className="mt-1 text-sm text-slate-500">Planning and advisory-preview events for the active location only.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Inference</th><th className="px-4 py-3">External write</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invocations.map((item) => <tr key={item._id}><td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(item.createdAt)}</td><td className="px-4 py-3 font-semibold text-slate-800">{item.requestedAction}</td><td className="px-4 py-3"><StatusBadge tone={item.status === "advisory_previewed" ? "emerald" : item.status === "failed" || item.status === "rejected" ? "rose" : "slate"}>{item.status}</StatusBadge></td><td className="px-4 py-3 font-mono text-xs text-slate-600">{shortId(item.evidenceId, 14)}</td><td className="px-4 py-3 text-slate-600">{item.inferenceExecuted ? "Yes" : "No"}</td><td className="px-4 py-3 text-slate-600">{item.externalWriteAuthorised ? "Authorised" : "Disabled"}</td></tr>)}
                {!invocations.length ? <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No AI governance events recorded for this location yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
