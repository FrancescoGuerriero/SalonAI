import {
  ArrowRight,
  FlaskConical,
  ServerCog,
  ShieldCheck,
} from "lucide-react";

import {
  capabilityReasonLabel,
  compactFingerprint,
} from "./productCompositionPresentation.js";

function ReviewFlag({
  active,
  children,
}) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-bold " +
        (active
          ? "border-stone-800 bg-stone-900 text-white"
          : "border-black/10 bg-stone-100 text-stone-600")
      }
    >
      {active ? <ShieldCheck size={13} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export default function TenantProductUpgradeReview({
  plan,
}) {
  const transitions = Array.isArray(plan?.capabilityTransitions)
    ? plan.capabilityTransitions
    : [];

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-label="Tenant product upgrade review"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Zero-write upgrade review
          </p>
          <h2 className="mt-1 text-lg font-bold text-black">
            Revision {plan?.fromRevision || "—"} → {plan?.toRevision || "—"}
          </h2>
        </div>

        <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-800">
          writesPerformed: {String(Boolean(plan?.writesPerformed))}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ReviewFlag active={Boolean(plan?.requiresTenantAcceptance)}>
          Tenant acceptance
        </ReviewFlag>
        <ReviewFlag active={Boolean(plan?.requiresInfrastructureReview)}>
          Infrastructure review
        </ReviewFlag>
        <ReviewFlag active={Boolean(plan?.requiresPlatformUpgradeReview)}>
          Platform upgrade review
        </ReviewFlag>
        <ReviewFlag active={Boolean(plan?.containsExperimentalCapability)}>
          <FlaskConical size={13} aria-hidden="true" />
          Experimental approval
        </ReviewFlag>
      </div>

      {transitions.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {transitions.map((transition) => (
            <article
              key={transition.key}
              className="rounded-xl border border-black/10 bg-stone-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-black">
                  {transition.label || transition.key}
                </h3>
                <span className="text-xs font-bold uppercase tracking-wide text-stone-600">
                  {transition.status || "active"}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-bold text-stone-700">
                  {transition.fromEnabled ? "Enabled" : "Unavailable"}
                </span>
                <ArrowRight size={16} aria-hidden="true" className="text-amber-800" />
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                  {transition.toEnabled ? "Enabled" : "Unavailable"}
                </span>
              </div>

              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="font-bold text-stone-600">From</dt>
                  <dd className="mt-0.5 text-stone-700">
                    {capabilityReasonLabel(transition.fromReason)}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-stone-600">To</dt>
                  <dd className="mt-0.5 text-stone-700">
                    {capabilityReasonLabel(transition.toReason)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-600">
          No capability state changes are present in this upgrade plan.
        </p>
      )}

      {Array.isArray(plan?.profileChanges) && plan.profileChanges.length ? (
        <div className="mt-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
            <ServerCog size={15} aria-hidden="true" />
            Profile changes
          </p>
          <ul className="mt-2 space-y-2">
            {plan.profileChanges.map((change, index) => (
              <li
                key={(change.field || "change") + "-" + index}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-stone-700"
              >
                <strong className="font-bold text-black">
                  {change.field}
                </strong>
                {Object.prototype.hasOwnProperty.call(change, "from")
                  ? " · " + String(change.from || "—") + " → " + String(change.to || "—")
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan?.upgradeFingerprint ? (
        <p className="mt-5 break-all rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-stone-700">
          Upgrade fingerprint:{" "}
          <strong className="font-bold text-black">
            {compactFingerprint(plan.upgradeFingerprint)}
          </strong>
        </p>
      ) : null}
    </section>
  );
}
