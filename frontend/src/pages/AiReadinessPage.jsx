import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Database,
  Eye,
  Fingerprint,
  History,
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
} from "../Services/dataHubService.js";

function errorMessage(error) {
  return error?.response?.data?.message || error?.message || "The AI readiness request could not be completed.";
}

function shortId(value, length = 16) {
  const text = String(value || "");
  if (!text) return "—";
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
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

export default function AiReadinessPage() {
  const [savedViews, setSavedViews] = useState([]);
  const [invocations, setInvocations] = useState([]);
  const [viewId, setViewId] = useState("");
  const [requestedAction, setRequestedAction] = useState("analyse");
  const [evidence, setEvidence] = useState(null);
  const [plan, setPlan] = useState(null);
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

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [views, audit] = await Promise.all([
        listSavedViews(),
        listAiGatewayInvocations({ limit: 25 }),
      ]);
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

  async function previewEvidence() {
    setWorking("evidence");
    setError("");
    setPlan(null);
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
    try {
      const result = await planAiGateway({
        ...evidencePayload,
        toolKey: "marketing-insights",
        requestedAction,
      });
      setPlan(result);
      setEvidence(result.evidence || evidence);
      setInvocations(await listAiGatewayInvocations({ limit: 25 }));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8" id="main-content" tabIndex="-1">
        <Loader2 className="mx-auto mt-24 animate-spin text-indigo-600" size={32} />
      </main>
    );
  }

  const latest = invocations[0] || null;
  const providers = Array.from(new Set((evidence?.provenance || []).map((item) => item.provider).filter(Boolean)));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><Sparkles size={18} /> Stage 8 · AI readiness</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Location AI readiness & planning preview</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                Inspect the selected SALON AI location's canonical evidence, provenance and planning history before any AI execution is enabled.
              </p>
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
              <p className="font-bold">Governed planning only for the selected location.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge tone="indigo">Location-owned</StatusBadge>
                <StatusBadge tone="amber">Planning only</StatusBadge>
                <StatusBadge tone="rose">Inference disabled</StatusBadge>
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
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><History size={19} className="text-indigo-600" /><p className="mt-3 text-2xl font-bold text-slate-900">{invocations.length}</p><p className="text-sm font-semibold text-slate-500">Recent planning events</p></article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Bot size={19} className="text-indigo-600" /><h2 className="text-xl font-bold text-slate-900">Planning readiness</h2></div>
            <p className="mt-1 text-sm text-slate-500">Current Stage 8 bridge capability: Marketing Insights using canonical Data Hub evidence.</p>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Evidence source
                <select value={viewId} onChange={(event) => { setViewId(event.target.value); setEvidence(null); setPlan(null); }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Default 30-day location query</option>
                  {savedViews.map((view) => <option key={view._id} value={view._id}>{view.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Requested planning action
                <select value={requestedAction} onChange={(event) => setRequestedAction(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="analyse">Analyse</option>
                  <option value="summarise">Summarise</option>
                  <option value="forecast">Forecast</option>
                  <option value="recommend">Recommend</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => void previewEvidence()} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 disabled:opacity-50">
                {working === "evidence" ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Preview evidence
              </button>
              <button type="button" onClick={() => void previewPlan()} disabled={Boolean(working)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {working === "plan" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Request planning preview
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Requesting a planning preview records an audit event only. It does not run inference, train or promote a model, schedule work, or authorise an external action.
            </div>
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
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Provenance records</dt><dd className="mt-1 font-bold text-slate-900">{evidence.provenance?.length || 0}</dd></div>
                </dl>
                <div><p className="text-xs font-bold uppercase text-slate-500">Providers represented</p><div className="mt-2 flex flex-wrap gap-2">{providers.length ? providers.map((provider) => <StatusBadge key={provider} tone="indigo">{provider}</StatusBadge>) : <StatusBadge>No provider evidence yet</StatusBadge>}</div></div>
                <div className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100"><pre>{JSON.stringify((evidence.facts || []).slice(0, 25), null, 2)}</pre></div>
              </div>
            ) : <div className="mt-8 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500"><Eye className="mx-auto mb-3 text-slate-300" size={34} />Preview evidence to inspect the selected location's canonical facts and provenance.</div>}
          </article>
        </section>

        {plan ? (
          <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3"><CheckCircle2 size={21} className="mt-0.5 text-indigo-600" /><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Planning preview recorded</p><h2 className="mt-1 text-xl font-bold text-slate-900">No AI execution occurred</h2><p className="mt-1 text-sm text-slate-600">{plan.message}</p></div></div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Invocation</dt><dd className="mt-1 font-mono text-xs font-bold text-slate-900">{shortId(plan.invocationId, 24)}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Tool</dt><dd className="mt-1 font-bold text-slate-900">Marketing Insights</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">Inference</dt><dd className="mt-1 font-bold text-rose-700">Disabled</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">External write</dt><dd className="mt-1 font-bold text-rose-700">Disabled</dd></div>
            </dl>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><History size={19} className="text-indigo-600" /><h2 className="text-xl font-bold text-slate-900">Location AI planning audit history</h2></div>
          <p className="mt-1 text-sm text-slate-500">Only planning events belonging to the currently selected location are returned.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Tool</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Facts</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Execution</th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invocations.map((item) => (
                  <tr key={item._id}><td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatTime(item.createdAt)}</td><td className="px-4 py-3 font-semibold text-slate-900">{item.toolKey}</td><td className="px-4 py-3 text-slate-700">{item.requestedAction}</td><td className="px-4 py-3 font-mono text-xs text-slate-600">{shortId(item.evidenceId)}</td><td className="px-4 py-3 text-slate-700">{item.factCount}</td><td className="px-4 py-3"><StatusBadge tone={item.status === "planned" ? "emerald" : item.status === "rejected" ? "amber" : "rose"}>{item.status}</StatusBadge></td><td className="px-4 py-3"><StatusBadge tone="rose">disabled</StatusBadge></td></tr>
                ))}
              </tbody>
            </table>
            {!invocations.length ? <div className="p-8 text-center text-sm text-slate-500">No AI planning events have been recorded for this location yet.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
