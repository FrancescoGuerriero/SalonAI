import { ArrowLeft, BarChart3, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { listAiBaselineComparisons, listAiOfflineExperiments } from "../Services/dataHubService.js";

function pct(value, total) {
  if (!total) return "0%";
  return `${Math.round((Number(value || 0) / Number(total)) * 100)}%`;
}

function metricAverage(runs, field) {
  const values = [];
  runs.forEach((run) => {
    (run.cases || []).forEach((item) => {
      const value = Number(item.metrics?.[field]);
      if (Number.isFinite(value)) values.push(value);
    });
  });
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shortHash(value) {
  const text = String(value || "");
  return text ? `${text.slice(0, 10)}…${text.slice(-8)}` : "—";
}

function signed(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number.toFixed(3)}`;
}

function metricLabel(metric) {
  return ({
    citationIntegrityRate: "Citation integrity",
    factualGroundingRate: "Factual grounding",
    unsupportedClaimRate: "Unsupported claims",
    provenanceValidityRate: "Provenance validity",
    provenanceCoverageRate: "Provenance coverage",
  })[metric] || metric;
}

export default function AiOfflineExperimentComparisonPage() {
  const [runs, setRuns] = useState([]);
  const [baselineComparisons, setBaselineComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [experimentRuns, comparisons] = await Promise.all([
        listAiOfflineExperiments({ limit: 100 }),
        listAiBaselineComparisons({ limit: 100 }),
      ]);
      setRuns(experimentRuns);
      setBaselineComparisons(comparisons);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to load offline experiment comparison evidence.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const comparisons = useMemo(() => {
    const groups = new Map();
    runs.forEach((run) => {
      const artifact = run.model?.artifactSha256 || "unknown";
      const key = `${run.candidateKind}:${run.candidateVersion}:${artifact}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(run);
    });

    return Array.from(groups.entries()).map(([key, group]) => {
      const requested = group.reduce((sum, run) => sum + Number(run.requestedCaseCount || 0), 0);
      const completed = group.reduce((sum, run) => sum + Number(run.completedCaseCount || 0), 0);
      const quality = group.reduce((sum, run) => sum + Number(run.qualityPassedCases || 0), 0);
      const baseline = group.reduce((sum, run) => sum + Number(run.baselinePassedCases || 0), 0);
      const reproducible = group.reduce((sum, run) => sum + Number(run.reproducibleCases || 0), 0);
      const eligible = group.reduce((sum, run) => sum + Number(run.promotionReviewEligibleCases || 0), 0);
      const exemplar = group[0] || {};
      return {
        key,
        runs: group.length,
        candidateKind: exemplar.candidateKind,
        candidateVersion: exemplar.candidateVersion,
        model: exemplar.model || {},
        requested,
        completed,
        quality,
        baseline,
        reproducible,
        eligible,
        citationIntegrity: metricAverage(group, "citationIntegrityRate"),
        factualGrounding: metricAverage(group, "factualGroundingRate"),
        unsupportedClaims: metricAverage(group, "unsupportedClaimRate"),
        provenanceValidity: metricAverage(group, "provenanceValidityRate"),
        latestAt: group.map((item) => item.createdAt).filter(Boolean).sort().at(-1) || null,
      };
    }).sort((a, b) => String(b.latestAt || "").localeCompare(String(a.latestAt || "")));
  }, [runs]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><BarChart3 size={18} /> Stage 8 · offline model evaluation</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Offline experiment comparison</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Compare location-owned shadow/offline model artifacts against the governed deterministic baseline using recorded experiment and evidence-derived comparison results. This workspace is read-only and cannot train, deploy, promote, activate or invoke production inference.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"><RefreshCw size={16} /> Refresh</button>
              <Link to="/admin/system/ai-candidate-governance" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><ArrowLeft size={16} /> Candidate governance</Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Production inference disabled", "Production promotion disabled", "Deployment disabled", "External writes disabled"].map((label) => (
            <div key={label} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><ShieldCheck className="mr-2 inline" size={16} />{label}</div>
          ))}
        </section>

        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Artifact comparison</h2>
              <p className="mt-1 text-sm text-slate-600">25-case benchmark progress is shown from recorded experiment cases only; no score is inferred from missing runs.</p>
            </div>
            <div className="text-sm font-semibold text-slate-500">{comparisons.length} artifact version{comparisons.length === 1 ? "" : "s"}</div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Artifact</th>
                  <th className="px-3 py-3">Cases</th>
                  <th className="px-3 py-3">Quality</th>
                  <th className="px-3 py-3">Baseline</th>
                  <th className="px-3 py-3">Reproducible</th>
                  <th className="px-3 py-3">Citation integrity</th>
                  <th className="px-3 py-3">Grounding</th>
                  <th className="px-3 py-3">Unsupported</th>
                  <th className="px-3 py-3">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisons.map((item) => (
                  <tr key={item.key} className="align-top">
                    <td className="px-3 py-4">
                      <div className="font-bold text-slate-900">{item.candidateVersion || "Unversioned"}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.candidateKind} · {item.model.algorithm || "algorithm n/a"}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500" title={item.model.artifactSha256}>{shortHash(item.model.artifactSha256)}</div>
                    </td>
                    <td className="px-3 py-4"><div className="font-bold text-slate-900">{item.completed}/{item.requested}</div><div className="text-xs text-slate-500">{Math.min(25, item.completed)}/25 benchmark cases · {item.runs} run(s)</div></td>
                    <td className="px-3 py-4 font-semibold">{pct(item.quality, item.requested)}</td>
                    <td className="px-3 py-4 font-semibold">{pct(item.baseline, item.requested)}</td>
                    <td className="px-3 py-4 font-semibold">{pct(item.reproducible, item.requested)}</td>
                    <td className="px-3 py-4">{item.citationIntegrity == null ? "—" : item.citationIntegrity.toFixed(3)}</td>
                    <td className="px-3 py-4">{item.factualGrounding == null ? "—" : item.factualGrounding.toFixed(3)}</td>
                    <td className="px-3 py-4">{item.unsupportedClaims == null ? "—" : item.unsupportedClaims.toFixed(3)}</td>
                    <td className="px-3 py-4">{item.provenanceValidity == null ? "—" : item.provenanceValidity.toFixed(3)}</td>
                  </tr>
                ))}
                {!loading && !comparisons.length ? <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No offline/shadow experiment evidence has been recorded for this location yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Evidence-derived baseline deltas</h2>
              <p className="mt-1 text-sm text-slate-600">Each record compares one model candidate with the deterministic baseline for the same location, action, policy and canonical evidence case.</p>
            </div>
            <div className="text-sm font-semibold text-slate-500">{baselineComparisons.length} comparison{baselineComparisons.length === 1 ? "" : "s"}</div>
          </div>

          <div className="mt-4 grid gap-4">
            {baselineComparisons.map((comparison) => (
              <article key={comparison._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{comparison.candidateVersion}</div>
                    <div className="mt-1 text-xs text-slate-500">{comparison.candidateKind} · baseline {comparison.baselineVersion} · {comparison.requestedAction}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500" title={comparison.artifactSha256}>{shortHash(comparison.artifactSha256)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{comparison.baselineComparisonPassed ? "Non-degradation passed" : "Blocked"}</div>
                    <div className="mt-1 text-xs text-slate-500">{comparison.qualifyingOfflineCases || 0}/{comparison.requiredOfflineCases || 25} qualifying cases · suite {comparison.suiteGatePassed ? "passed" : "not passed"}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {(comparison.metricDeltas || []).map((metric) => (
                    <div key={metric.metric} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-500">{metricLabel(metric.metric)}</div>
                      <div className="mt-1 text-lg font-bold text-slate-900">{signed(metric.delta)}</div>
                      <div className="text-xs text-slate-500">candidate {Number(metric.candidateValue || 0).toFixed(3)} · baseline {Number(metric.baselineValue || 0).toFixed(3)}</div>
                      <div className="mt-1 text-xs font-bold">{metric.nonDegraded ? "non-degraded" : "degraded"} · {metric.direction}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><span className="text-slate-500">Identity</span><div className="font-bold">{comparison.identityNonDegraded ? "non-degraded" : "blocked"}</div></div>
                  <div><span className="text-slate-500">Safety</span><div className="font-bold">{comparison.safetyNonDegraded ? "non-degraded" : "blocked"}</div></div>
                  <div><span className="text-slate-500">Reproducibility</span><div className="font-bold">{comparison.reproducibilityNonDegraded ? "non-degraded" : "blocked"}</div></div>
                  <div><span className="text-slate-500">Repeated-run evidence</span><div className="font-bold">{comparison.repeatedRunEvidenceSufficient ? "sufficient" : "insufficient"}</div></div>
                </div>

                {comparison.blockers?.length ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Blockers: {comparison.blockers.join(", ")}</div> : null}
              </article>
            ))}
            {!loading && !baselineComparisons.length ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No evidence-derived baseline comparisons have been recorded for this location yet.</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Recent experiment runs</h2>
          <div className="mt-4 grid gap-3">
            {runs.slice(0, 20).map((run) => (
              <article key={run._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{run.runKey}</div>
                    <div className="mt-1 text-xs text-slate-500">{run.candidateVersion} · {run.candidateKind} · {new Date(run.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{run.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <div><span className="text-slate-500">Completed</span><div className="font-bold">{run.completedCaseCount}/{run.requestedCaseCount}</div></div>
                  <div><span className="text-slate-500">Quality passed</span><div className="font-bold">{run.qualityPassedCases}</div></div>
                  <div><span className="text-slate-500">Baseline passed</span><div className="font-bold">{run.baselinePassedCases}</div></div>
                  <div><span className="text-slate-500">Reproducible</span><div className="font-bold">{run.reproducibleCases}</div></div>
                  <div><span className="text-slate-500">Review eligible</span><div className="font-bold">{run.promotionReviewEligibleCases}</div></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
