import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getSystemObservabilityOverview,
} from "../Services/systemObservabilityService.js";

const STATUS_STYLES = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  disconnected: "border-slate-300 bg-slate-100 text-slate-700",
  unknown: "border-slate-200 bg-white text-slate-600",
};

function formatDate(value) {
  if (!value) return "No evidence";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "No evidence" : parsed.toLocaleString();
}

function StatusBadge({ status }) {
  const normalised = STATUS_STYLES[status] ? status : "unknown";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLES[normalised]}`}>
      {normalised}
    </span>
  );
}

function MetricCard({ label, value, icon: Icon, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon size={21} />
        </div>
      </div>
      {detail ? <p className="mt-3 text-sm text-slate-600">{detail}</p> : null}
    </article>
  );
}

export default function SystemObservabilityPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getSystemObservabilityOverview()
      .then((data) => {
        if (!active) return;
        setOverview(data);
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.message ||
            "Observability evidence could not be loaded."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const connectors = overview?.connectors || [];
  const connectorSummary = overview?.connectorSummary || {};
  const ai = overview?.ai || {};

  const attentionCount = useMemo(
    () =>
      Number(connectorSummary.degraded || 0) +
      Number(connectorSummary.error || 0) +
      Number(connectorSummary.disconnected || 0),
    [connectorSummary]
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
                <Activity size={18} /> AIIBP system capability
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Observability & Health</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                Read-only tenant health evidence for provider connectors, AI governance readiness and operational telemetry boundaries. The workspace never exposes provider secrets or performs retries, reconnects, deployments or model activation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/system/connections" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
                Provider connections
              </Link>
              <Link to="/admin/system/ai-candidate-governance" className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700">
                AI governance
              </Link>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Loading governed health evidence…
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        {!loading && overview ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="System health summary">
              <MetricCard label="Connector records" value={connectorSummary.total || 0} icon={PlugZap} detail={`${connectorSummary.healthy || 0} healthy`} />
              <MetricCard label="Needs attention" value={attentionCount} icon={AlertTriangle} detail="Degraded, error or disconnected connectors" />
              <MetricCard label="Governed AI datasets" value={ai.datasetCount || 0} icon={Database} detail={`${ai.frozenDatasetCount || 0} frozen`} />
              <MetricCard label="AI candidates" value={ai.candidateModelCount || 0} icon={Bot} detail={`${ai.approvedModelCount || 0} approved; ${ai.productionModelCount || 0} production records`} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Provider and integration health</h2>
                  <p className="mt-1 text-sm text-slate-600">Business-scoped ConnectorHealth evidence only. Credentials and secret material are never returned.</p>
                </div>
                <span className="text-xs text-slate-500">Generated {formatDate(overview.generatedAt)}</span>
              </div>

              {connectors.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {connectors.map((connector) => (
                    <article key={connector.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-slate-900">{connector.componentKey}</h3>
                          <p className="mt-1 text-xs text-slate-500">Last success: {formatDate(connector.lastSuccessAt)}</p>
                        </div>
                        <StatusBadge status={connector.status} />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div><dt className="font-bold text-slate-500">Latency</dt><dd className="mt-1 text-slate-700">{connector.latencyMs === null ? "No evidence" : `${connector.latencyMs} ms`}</dd></div>
                        <div><dt className="font-bold text-slate-500">Last failure</dt><dd className="mt-1 text-slate-700">{formatDate(connector.lastFailureAt)}</dd></div>
                        <div><dt className="font-bold text-slate-500">Retry</dt><dd className="mt-1 text-slate-700">{formatDate(connector.retryAt)}</dd></div>
                        <div><dt className="font-bold text-slate-500">Token expiry</dt><dd className="mt-1 text-slate-700">{formatDate(connector.tokenExpiresAt)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
                  No tenant-scoped connector health records are currently available.
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck size={18} /> AI service governance</div>
                <p className="mt-3 text-sm leading-6 text-slate-600">Production training: {ai.productionTrainingEnabled ? "Enabled" : "Disabled"}. Automatic promotion: {ai.automaticPromotionEnabled ? "Enabled" : "Disabled"}. Automatic inference activation: {ai.automaticInferenceActivationEnabled ? "Enabled" : "Disabled"}.</p>
              </article>

              <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-amber-900"><Clock3 size={18} /> Background jobs</div>
                <p className="mt-3 text-sm leading-6 text-amber-800">{overview.backgroundJobs?.reason}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-700">Scope unavailable — no inferred worker status</p>
              </article>

              <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-amber-900"><AlertTriangle size={18} /> Dead letters</div>
                <p className="mt-3 text-sm leading-6 text-amber-800">{overview.deadLetters?.reason}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-700">0 tenant records exposed</p>
              </article>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Observability safety boundary</div>
              <p className="mt-2 leading-6">This workspace is read-only, does not expose secrets, does not aggregate cross-tenant telemetry and cannot trigger operational writes.</p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
