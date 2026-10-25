import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  listAiCandidateEvaluations,
  reviewAiCandidateEvaluation,
} from "../../Services/dataHubService.js";

function shortId(value, length = 14) {
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

function errorMessage(error) {
  return error?.response?.data?.message
    || error?.response?.data?.code
    || error?.message
    || "The candidate governance request could not be completed.";
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function reviewTone(status) {
  if (status === "accepted_for_promotion_proposal") return "emerald";
  if (status === "pending_review") return "amber";
  if (status === "rejected") return "rose";
  return "slate";
}

function ReviewPanel({ record, canReview, onClose, onReviewed }) {
  const [note, setNote] = useState(record.reviewerNote || "");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  async function submit(decision) {
    setWorking(decision);
    setError("");
    try {
      await reviewAiCandidateEvaluation(record._id, { decision, note });
      await onReviewed();
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  const readiness = record.promotionReadiness || {};
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Human promotion-proposal review</p>
          <h4 className="mt-1 font-bold text-slate-900">{record.model?.name || record.candidateVersion}</h4>
          <p className="mt-1 text-sm text-slate-600">This review cannot activate, promote or run a production model.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Close</button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Quality gate</dt><dd className="mt-1 font-bold text-slate-900">{record.qualityGatePassed ? "Passed" : "Failed"}</dd></div>
        <div className="rounded-lg bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Baseline</dt><dd className="mt-1 font-bold text-slate-900">{record.baselineComparisonPassed ? "Beaten" : "Not beaten"}</dd></div>
        <div className="rounded-lg bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Cases</dt><dd className="mt-1 font-bold text-slate-900">{readiness.qualifyingOfflineCases || 0}/{readiness.requiredOfflineCases || 0}</dd></div>
        <div className="rounded-lg bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Runs / case</dt><dd className="mt-1 font-bold text-slate-900">{readiness.repeatedRunCount || 0}/{readiness.minimumRepeatedRunsPerCase || 0}</dd></div>
      </dl>

      {record.blockers?.length ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">Current blockers</p>
          <p className="mt-1 font-mono text-xs">{record.blockers.join(" · ")}</p>
        </div>
      ) : null}

      {error ? <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}</div> : null}

      {canReview && record.promotionReviewStatus === "pending_review" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Reviewer note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows="3" maxLength="2000" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" placeholder="Record the basis for the human review decision." />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={Boolean(working)} onClick={() => void submit("accept")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{working === "accept" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Accept for promotion proposal</button>
            <button type="button" disabled={Boolean(working)} onClick={() => void submit("reject")} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50">{working === "reject" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject candidate</button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-slate-600">{record.promotionReviewStatus === "pending_review" ? "Your role can inspect this review but does not have the management permission required to decide it." : "This record is not awaiting a human review decision."}</p>
      )}
    </div>
  );
}

export default function AiCandidateGovernancePanel({ canReview = false }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRecords(await listAiCandidateEvaluations({ limit: 50 }));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const pending = records.filter((item) => item.promotionReviewStatus === "pending_review").length;
    const accepted = records.filter((item) => item.promotionReviewStatus === "accepted_for_promotion_proposal").length;
    const best = records.reduce((current, item) => {
      const readiness = item.promotionReadiness || {};
      const required = Number(readiness.requiredOfflineCases || 0);
      const qualifying = Number(readiness.qualifyingOfflineCases || 0);
      const ratio = required > 0 ? qualifying / required : 0;
      return ratio > current.ratio ? { ratio, qualifying, required } : current;
    }, { ratio: 0, qualifying: 0, required: 0 });
    return { pending, accepted, best };
  }, [records]);

  const selected = records.find((item) => item._id === selectedId) || null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><ClipboardCheck size={19} className="text-indigo-600" /><h2 className="text-xl font-bold text-slate-900">AI candidate governance</h2></div>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">Location-owned model/advisory evaluation records. A candidate needs the full governed benchmark suite before human promotion-proposal review becomes available.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh candidates</button>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
        <div className="flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><p><span className="font-bold">Production lock:</span> review can accept evidence for a future promotion proposal only. Production promotion, inference and external writes remain disabled.</p></div>
      </div>

      {error ? <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}</div> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Records</p><p className="mt-2 text-2xl font-bold text-slate-900">{records.length}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending human review</p><p className="mt-2 text-2xl font-bold text-slate-900">{summary.pending}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Best suite progress</p><p className="mt-2 text-2xl font-bold text-slate-900">{summary.best.required ? `${summary.best.qualifying}/${summary.best.required}` : "—"}</p></div>
      </div>

      {selected ? <div className="mt-5"><ReviewPanel record={selected} canReview={canReview} onClose={() => setSelectedId("")} onReviewed={load} /></div> : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Artifact</th><th className="px-4 py-3">Quality</th><th className="px-4 py-3">Benchmark</th><th className="px-4 py-3">Review</th><th className="px-4 py-3">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((item) => {
              const readiness = item.promotionReadiness || {};
              return (
                <tr key={item._id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatTime(item.createdAt)}</td>
                  <td className="px-4 py-3"><p className="font-bold text-slate-900">{item.model?.name || item.candidateVersion}</p><p className="mt-1 text-xs text-slate-500">{item.candidateKind} · {item.requestedAction}</p></td>
                  <td className="px-4 py-3"><p className="font-mono text-xs text-slate-700">{shortId(item.model?.artifactSha256 || item.candidateOutputHash)}</p><p className="mt-1 text-xs text-slate-500">{item.model?.version || item.candidateVersion}</p></td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><Badge tone={item.qualityGatePassed ? "emerald" : "rose"}>{item.qualityGatePassed ? "Quality passed" : "Quality failed"}</Badge><Badge tone={item.baselineComparisonPassed ? "emerald" : "amber"}>{item.baselineComparisonPassed ? "Baseline beaten" : "Baseline not beaten"}</Badge></div></td>
                  <td className="px-4 py-3"><p className="font-bold text-slate-900">{readiness.qualifyingOfflineCases || 0}/{readiness.requiredOfflineCases || 0} cases</p><p className="mt-1 text-xs text-slate-500">{readiness.repeatedRunCount || 0}/{readiness.minimumRepeatedRunsPerCase || 0} runs this case</p></td>
                  <td className="px-4 py-3"><Badge tone={reviewTone(item.promotionReviewStatus)}>{item.promotionReviewStatus}</Badge></td>
                  <td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(item._id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"><FileCheck2 size={14} /> Inspect</button></td>
                </tr>
              );
            })}
            {!records.length && !loading ? <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No candidate evaluation records exist for this location yet.</td></tr> : null}
            {loading ? <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500"><Loader2 size={20} className="mx-auto animate-spin" /></td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
