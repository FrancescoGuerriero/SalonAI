import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createAiPromotionProposal,
  listAiCandidateEvaluations,
  listAiPromotionProposals,
  updateAiPromotionProposal,
} from "../Services/dataHubService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

function message(error) {
  return error?.response?.data?.message || error?.response?.data?.code || error?.message || "The promotion proposal request failed.";
}

function Status({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.slate}`}>{children}</span>;
}

const EMPTY_FORM = {
  candidateEvaluationId: "",
  rationale: "",
  expectedBenefit: "",
  riskAssessment: "",
  rollbackPlan: "",
  monitoringPlan: "",
  incidentOwner: "",
  proposedDeploymentWindow: "",
};

export default function AiPromotionProposalPage() {
  const { user } = useAuth();
  const canUpdate = hasPermission(user, "feature-control:update");
  const [dossiers, setDossiers] = useState([]);
  const [eligibleCandidates, setEligibleCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [proposalRows, candidateRows] = await Promise.all([
        listAiPromotionProposals({ limit: 100 }),
        listAiCandidateEvaluations({ promotionReviewStatus: "accepted_for_promotion_proposal", limit: 100 }),
      ]);
      setDossiers(proposalRows);
      const existingIds = new Set(proposalRows.map((item) => String(item.candidateEvaluation || "")));
      setEligibleCandidates(candidateRows.filter((item) => !existingIds.has(String(item._id))));
      setSelected((current) => current ? proposalRows.find((item) => item._id === current._id) || null : null);
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const checklist = useMemo(() => selected?.checklist || {}, [selected]);

  function openDossier(item) {
    setSelected(item);
    setForm({
      candidateEvaluationId: String(item.candidateEvaluation || ""),
      rationale: item.rationale || "",
      expectedBenefit: item.expectedBenefit || "",
      riskAssessment: item.riskAssessment || "",
      rollbackPlan: item.rollbackPlan || "",
      monitoringPlan: item.monitoringPlan || "",
      incidentOwner: item.incidentOwner || "",
      proposedDeploymentWindow: item.proposedDeploymentWindow || "",
    });
    setError("");
    setNotice("");
  }

  function startNew() {
    setSelected(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
  }

  async function createDossier() {
    if (!canUpdate || !form.candidateEvaluationId) return;
    setWorking("create");
    setError("");
    setNotice("");
    try {
      const result = await createAiPromotionProposal(form);
      setNotice(result.message || "Promotion proposal dossier created.");
      await load();
      if (result.dossier) openDossier(result.dossier);
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setWorking("");
    }
  }

  async function updateDossier(action = "save") {
    if (!canUpdate || !selected?._id) return;
    setWorking(action);
    setError("");
    setNotice("");
    try {
      const result = await updateAiPromotionProposal(selected._id, { ...form, action });
      setNotice(result.message || "Promotion proposal dossier updated.");
      await load();
      if (result.dossier) openDossier(result.dossier);
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-8"><Loader2 className="mx-auto mt-24 animate-spin text-indigo-600" size={32} /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><FileCheck2 size={18} /> Stage 8 · Change governance</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">AI promotion proposal dossiers</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Prepare a non-executing change dossier for a location-owned candidate that already passed benchmark and human promotion-proposal review. This workspace cannot deploy, activate, promote or run production inference.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/system/ai-candidate-governance" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><ArrowLeft size={16} /> Candidate governance</Link>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><RefreshCw size={16} /> Refresh</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3 text-sm leading-6 text-rose-950"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><div><p className="font-bold">Planning-only safety boundary</p><div className="mt-2 flex flex-wrap gap-2"><Status tone="rose">Deployment disabled</Status><Status tone="rose">Production promotion disabled</Status><Status tone="rose">Production inference disabled</Status><Status tone="rose">External writes disabled</Status></div></div></div>
        </section>

        {error ? <section role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"><AlertTriangle size={18} />{error}</section> : null}
        {notice ? <section className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} />{notice}</section> : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Location dossiers</h2>{canUpdate ? <button type="button" onClick={startNew} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">New dossier</button> : null}</div>
            <div className="mt-4 space-y-3">
              {dossiers.map((item) => (
                <button key={item._id} type="button" onClick={() => openDossier(item)} className={`w-full rounded-xl border p-4 text-left ${selected?._id === item._id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-slate-900">{item.model?.name || item.candidateVersion}</span><Status tone={item.proposalStatus === "ready_for_change_review" ? "emerald" : item.proposalStatus === "withdrawn" ? "rose" : "amber"}>{item.proposalStatus}</Status></div>
                  <p className="mt-2 text-xs text-slate-500">Artifact {String(item.model?.artifactSha256 || "").slice(0, 16) || "—"} · {item.governance?.qualifyingOfflineCases || 0}/{item.governance?.requiredOfflineCases || 0} cases</p>
                </button>
              ))}
              {!dossiers.length ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No promotion proposal dossiers exist for this location.</div> : null}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">{selected ? "Change-review dossier" : "Create promotion proposal dossier"}</h2>
            {!selected ? (
              <label className="mt-4 block text-sm font-semibold text-slate-700">Eligible candidate
                <select value={form.candidateEvaluationId} onChange={(event) => setForm((value) => ({ ...value, candidateEvaluationId: event.target.value }))} disabled={!canUpdate} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100">
                  <option value="">Select accepted candidate</option>
                  {eligibleCandidates.map((item) => <option key={item._id} value={item._id}>{item.model?.name || item.candidateVersion} · {item.model?.version || item.candidateVersion}</option>)}
                </select>
              </label>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2"><Status tone="indigo">{selected.model?.name || selected.candidateVersion}</Status><Status>{selected.model?.version || selected.candidateVersion}</Status><Status tone="emerald">Benchmark {selected.governance?.qualifyingOfflineCases || 0}/{selected.governance?.requiredOfflineCases || 0}</Status></div>
            )}

            <div className="mt-5 grid gap-4">
              {[ ["rationale","Rationale"], ["expectedBenefit","Expected benefit"], ["riskAssessment","Risk assessment"], ["rollbackPlan","Rollback plan"], ["monitoringPlan","Monitoring plan"] ].map(([key,label]) => <label key={key} className="text-sm font-semibold text-slate-700">{label}<textarea rows="3" value={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} disabled={!canUpdate || selected?.proposalStatus === "withdrawn"} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" /></label>)}
              <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Incident owner<input value={form.incidentOwner} onChange={(event) => setForm((value) => ({ ...value, incidentOwner: event.target.value }))} disabled={!canUpdate || selected?.proposalStatus === "withdrawn"} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" /></label><label className="text-sm font-semibold text-slate-700">Proposed deployment window<input value={form.proposedDeploymentWindow} onChange={(event) => setForm((value) => ({ ...value, proposedDeploymentWindow: event.target.value }))} disabled={!canUpdate || selected?.proposalStatus === "withdrawn"} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" /></label></div>
            </div>

            {selected ? <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Readiness checklist</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(checklist).map(([key,value]) => <Status key={key} tone={value ? "emerald" : "amber"}>{key}: {value ? "yes" : "no"}</Status>)}</div></div> : null}

            {canUpdate ? <div className="mt-5 flex flex-wrap gap-3">{!selected ? <button type="button" onClick={() => void createDossier()} disabled={Boolean(working) || !form.candidateEvaluationId} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{working === "create" ? "Creating…" : "Create draft dossier"}</button> : selected.proposalStatus !== "withdrawn" ? <><button type="button" onClick={() => void updateDossier("save")} disabled={Boolean(working)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Save draft</button><button type="button" onClick={() => void updateDossier("mark_ready_for_change_review")} disabled={Boolean(working)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Mark ready for change review</button><button type="button" onClick={() => void updateDossier("withdraw")} disabled={Boolean(working)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50">Withdraw</button></> : null}</div> : <p className="mt-5 text-xs font-semibold text-amber-700">Your role can inspect dossiers but cannot change them.</p>}
          </article>
        </section>
      </div>
    </main>
  );
}
