import InstallationBlockerList from "./InstallationBlockerList.jsx";
import InstallationPlanSummary from "./InstallationPlanSummary.jsx";

export default function TenantInstallationReviewWorkspace({ plan, blockers, warnings }) {
  const safeBlockers = Array.isArray(blockers) && blockers.length ? blockers : Array.isArray(plan?.blocked) ? plan.blocked : [];
  const safeWarnings = Array.isArray(warnings) && warnings.length ? warnings : Array.isArray(plan?.warnings) ? plan.warnings : [];

  return (
    <section className="space-y-5" aria-labelledby="tenant-installation-review-title">
      <header className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">AI Intelligent Business Platform</p>
        <h1 id="tenant-installation-review-title" className="mt-1 text-xl font-bold text-black sm:text-2xl">Tenant installation review</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Review server-supplied dry-run or installation evidence before any explicit write request. This workspace does not calculate provisioning operations.</p>
      </header>
      <InstallationPlanSummary plan={plan} />
      <InstallationBlockerList blockers={safeBlockers} warnings={safeWarnings} />
    </section>
  );
}
