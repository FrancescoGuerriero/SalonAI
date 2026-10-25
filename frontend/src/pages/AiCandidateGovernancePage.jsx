import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import AiCandidateGovernancePanel from "../components/stage8/AiCandidateGovernancePanel.jsx";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

export default function AiCandidateGovernancePage() {
  const { user } = useAuth();
  const canReview = hasPermission(user, "feature-control:update");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><ShieldCheck size={18} /> Stage 8 · AI governance</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Location AI candidate governance</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Inspect location-owned offline/shadow candidate evaluations, benchmark-suite progress, artifact provenance and human promotion-proposal review state. This workspace cannot activate or promote a production model.</p>
            </div>
            <Link to="/admin/system/ai-readiness" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><ArrowLeft size={16} /> AI readiness</Link>
          </div>
        </section>

        <AiCandidateGovernancePanel canReview={canReview} />
      </div>
    </main>
  );
}
