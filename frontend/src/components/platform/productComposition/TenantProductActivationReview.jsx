import {
  Archive,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

import {
  approvalReasonLabel,
  compactFingerprint,
} from "./productCompositionPresentation.js";

export default function TenantProductActivationReview({
  plan,
  canRequestApproval = false,
  onRequestApprove,
}) {
  const reasons = Array.isArray(plan?.approvalReasons)
    ? plan.approvalReasons
    : [];
  const operations = Array.isArray(plan?.persistenceOperations)
    ? plan.persistenceOperations
    : [];

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-label="Tenant product activation review"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Activation plan
          </p>
          <h2 className="mt-1 text-lg font-bold text-black">
            Revision {plan?.fromRevision || "none"} → {plan?.toRevision || "—"}
          </h2>
        </div>

        <span
          className={
            "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold " +
            (plan?.approvalRequired
              ? "border-stone-800 bg-stone-900 text-white"
              : "border-amber-300 bg-amber-50 text-amber-800")
          }
        >
          {plan?.approvalRequired ? "Approval required" : "No approval required"}
        </span>
      </div>

      {reasons.length ? (
        <div className="mt-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
            <ShieldCheck size={15} aria-hidden="true" />
            Approval reasons
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {reasons.map((reason) => (
              <li
                key={reason}
                className="rounded-full border border-black/10 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700"
              >
                {approvalReasonLabel(reason)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {operations.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {operations.map((operation, index) => {
            const archive = operation.type === "archive-current-manifest";
            const Icon = archive ? Archive : FileCheck2;

            return (
              <article
                key={(operation.type || "operation") + "-" + index}
                className={
                  "rounded-xl border p-4 " +
                  (archive
                    ? "border-black/10 bg-stone-50"
                    : "border-amber-300 bg-amber-50")
                }
              >
                <div className="flex items-center gap-2">
                  <Icon size={17} aria-hidden="true" />
                  <h3 className="text-sm font-bold text-black">
                    {archive
                      ? "Archive current manifest"
                      : "Activate candidate manifest"}
                  </h3>
                </div>
                <p className="mt-2 text-xs text-stone-600">
                  Revision {operation.revision || "—"}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-700">
                  This is persistence intent for review. It does not prove that
                  a write has occurred.
                </p>
              </article>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-800">
          <CheckCircle2 size={13} aria-hidden="true" />
          writesPerformed: {String(Boolean(plan?.writesPerformed))}
        </span>

        {plan?.activationFingerprint ? (
          <span className="rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-xs text-stone-700">
            Activation fingerprint:{" "}
            <strong className="font-bold text-black">
              {compactFingerprint(plan.activationFingerprint)}
            </strong>
          </span>
        ) : null}
      </div>

      {plan?.approvalRequired && canRequestApproval && onRequestApprove ? (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onRequestApprove}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            Approve reviewed plan
          </button>
        </div>
      ) : null}
    </section>
  );
}
