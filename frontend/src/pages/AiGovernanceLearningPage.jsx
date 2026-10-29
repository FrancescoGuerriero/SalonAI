import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Database,
  FlaskConical,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import {
  getAiGovernanceLearningOverview,
} from "../Services/aiGovernanceLearningService.js";

const LAYER_LABELS = Object.freeze({
  general: "General AI",
  vertical: "Vertical AI",
  tenant: "Tenant AI",
  "continuous-ml": "Continuous ML",
});

function Stat({ label, value }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
    </article>
  );
}

export default function AiGovernanceLearningPage() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAiGovernanceLearningOverview()
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError?.response?.data?.message ||
              requestError?.message ||
              "AI governance evidence could not be loaded."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const profiles = useMemo(() => overview?.profiles || [], [overview]);
  const datasets = overview?.datasets || [];
  const models = overview?.models || [];
  const summary = overview?.summary || {};

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-700">
            <BrainCircuit size={20} /> AIIBP AI Core
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">AI Governance & Learning</h1>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
            Review governed training layers, tenant/vertical profiles, dataset readiness and model lifecycle evidence. This workspace is read-only: production training, automatic model promotion and automatic production inference activation remain disabled.
          </p>
        </header>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6">Loading governed AI evidence…</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">{error}</div> : null}

        {overview ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="AI governance summary">
              <Stat label="Datasets" value={summary.datasetCount || 0} />
              <Stat label="Frozen datasets" value={summary.frozenDatasetCount || 0} />
              <Stat label="Candidate models" value={summary.candidateModelCount || 0} />
              <Stat label="Approved models" value={summary.approvedModelCount || 0} />
              <Stat label="Production models" value={summary.productionModelCount || 0} />
            </section>

            <section aria-labelledby="ai-learning-layers">
              <h2 className="text-xl font-bold text-slate-950" id="ai-learning-layers">Learning architecture</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {(overview.layers || []).map((layer) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={layer.key}>
                    <ShieldCheck className="text-amber-700" size={22} />
                    <h3 className="mt-3 font-bold text-slate-950">{LAYER_LABELS[layer.key] || layer.key}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{layer.policy?.purpose}</p>
                    <div className="mt-4 text-xs font-semibold text-slate-500">Scope: {layer.policy?.scopeMode}</div>
                    <div className="mt-1 text-xs text-slate-500">{layer.datasetCount} dataset(s) · {layer.frozenDatasetCount} frozen</div>
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="ai-training-profiles">
              <h2 className="text-xl font-bold text-slate-950" id="ai-training-profiles">Training profiles</h2>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {profiles.length ? profiles.map((profile) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={profile.key}>
                    <h3 className="font-bold text-slate-950">{profile.displayName}</h3>
                    <p className="mt-1 text-sm text-slate-600">Vertical: {profile.verticalId} · Tenant blueprint: {profile.tenantBlueprintKey}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {Object.entries(profile.layers || {}).map(([key, layer]) => (
                        <div className="rounded-xl bg-slate-50 p-3" key={key}>
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{LAYER_LABELS[key] || key}</div>
                          <div className="mt-1 text-xs text-slate-600">{(layer.tasks || []).length} task(s) · {(layer.datasets || []).length} dataset contract(s)</div>
                        </div>
                      ))}
                    </div>
                  </article>
                )) : (
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No registered training profile matches this tenant vertical yet.</article>
                )}
              </div>
            </section>

            <section aria-labelledby="ai-datasets">
              <div className="flex items-center gap-2"><Database size={20} /><h2 className="text-xl font-bold text-slate-950" id="ai-datasets">Dataset readiness</h2></div>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Dataset</th><th className="p-3">Layer</th><th className="p-3">Status</th><th className="p-3">Snapshots</th><th className="p-3">Readiness</th></tr></thead>
                  <tbody>
                    {datasets.length ? datasets.map((dataset) => (
                      <tr className="border-t border-slate-100" key={dataset.id}>
                        <td className="p-3"><div className="font-semibold text-slate-900">{dataset.name}</div><div className="text-xs text-slate-500">v{dataset.version} · {dataset.task}</div></td>
                        <td className="p-3">{LAYER_LABELS[dataset.trainingContext?.layer] || dataset.trainingContext?.layer || "Unassigned"}</td>
                        <td className="p-3">{dataset.status}</td>
                        <td className="p-3">{dataset.snapshotCount}</td>
                        <td className="p-3">{dataset.readiness?.readyToFreeze ? "Ready to freeze" : `${dataset.readiness?.blockers?.length || 0} blocker(s)`}</td>
                      </tr>
                    )) : <tr><td className="p-4 text-slate-500" colSpan="5">No governed dataset metadata is visible in this tenant scope.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="ai-model-lifecycle">
              <div className="flex items-center gap-2"><FlaskConical size={20} /><h2 className="text-xl font-bold text-slate-950" id="ai-model-lifecycle">Candidate & model lifecycle</h2></div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {models.length ? models.map((model) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={model.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-950">{model.name} v{model.version}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">{model.lifecycle}</span></div>
                    <p className="mt-2 text-sm text-slate-600">{model.task} · {model.modelType}{model.algorithm ? ` · ${model.algorithm}` : ""}</p>
                    <p className="mt-2 text-xs text-slate-500">Dataset: {model.trainingDatasetName || model.trainingDatasetId || "Not exposed"}</p>
                    <p className="mt-1 text-xs text-slate-500">Human approval evidence: {model.hasHumanApproval ? "recorded" : "not recorded"}</p>
                  </article>
                )) : <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No tenant-visible model candidates are linked to governed datasets.</article>}
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 font-bold text-amber-950"><LockKeyhole size={20} /> Production safety boundary</div>
              <p className="mt-2 text-sm leading-6 text-amber-900">Training and model promotion are not executable from this page. Candidate evaluation must precede explicit human approval; automatic promotion and automatic production inference activation remain disabled.</p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
