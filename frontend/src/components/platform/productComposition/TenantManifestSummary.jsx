import { Boxes, GitBranch, Server } from "lucide-react";

import { compactFingerprint } from "./productCompositionPresentation.js";

const STATUS_STYLES = Object.freeze({
  draft: "border-black/10 bg-stone-100 text-black",
  active: "border-amber-300 bg-amber-50 text-amber-800",
  suspended: "border-black/15 bg-white text-black",
  archived: "border-stone-800 bg-stone-900 text-white",
});

export default function TenantManifestSummary({
  manifest,
  verticalLabel = "",
  manifestHash = "",
}) {
  const status = String(manifest?.status || "draft");
  const deploymentProfile = String(
    manifest?.deploymentProfile || "shared-saas"
  );

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-label="Tenant product manifest summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Tenant product manifest
          </p>
          <h2 className="mt-1 text-lg font-bold text-black">
            {verticalLabel || manifest?.verticalId || "Tenant product"}
          </h2>
        </div>

        <span
          className={
            "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold uppercase tracking-wide " +
            (STATUS_STYLES[status] || STATUS_STYLES.draft)
          }
        >
          {status}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
          <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
            <GitBranch size={14} aria-hidden="true" />
            Revision
          </dt>
          <dd className="mt-1 text-sm font-bold text-black">
            {manifest?.manifestRevision || "—"}
          </dd>
        </div>

        <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
          <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
            <Boxes size={14} aria-hidden="true" />
            Platform
          </dt>
          <dd className="mt-1 text-sm font-bold text-black">
            {manifest?.platformVersion || "Not set"}
          </dd>
        </div>

        <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
          <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
            <Server size={14} aria-hidden="true" />
            Deployment
          </dt>
          <dd className="mt-1 text-sm font-bold text-black">
            {deploymentProfile === "dedicated"
              ? "Dedicated environment"
              : "Shared SaaS"}
          </dd>
        </div>

        <div className="rounded-xl border border-black/10 bg-stone-50 p-3">
          <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
            Plan
          </dt>
          <dd className="mt-1 text-sm font-bold text-black">
            {manifest?.planKey || "Not specified"}
          </dd>
        </div>
      </dl>

      {manifestHash ? (
        <p className="mt-4 break-all rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-xs text-stone-600">
          Manifest fingerprint:{" "}
          <strong className="font-bold text-black">
            {compactFingerprint(manifestHash)}
          </strong>
        </p>
      ) : null}
    </section>
  );
}
