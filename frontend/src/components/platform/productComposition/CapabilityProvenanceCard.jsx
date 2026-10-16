import {
  CircleCheck,
  CircleOff,
  FlaskConical,
  ShieldAlert,
} from "lucide-react";

import { capabilityReasonLabel } from "./productCompositionPresentation.js";

export default function CapabilityProvenanceCard({
  capability,
}) {
  const enabled = Boolean(capability?.enabled);
  const status = String(capability?.status || "active");
  const reason = String(capability?.reason || "");
  const experimental = status === "experimental";
  const Icon = enabled ? CircleCheck : CircleOff;

  return (
    <article
      className={
        "rounded-xl border p-4 shadow-sm " +
        (enabled
          ? "border-amber-300 bg-amber-50"
          : "border-black/10 bg-white")
      }
      data-capability-key={capability?.key || ""}
      data-capability-enabled={String(enabled)}
      data-capability-reason={reason}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={
            "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border " +
            (enabled
              ? "border-amber-300 bg-white text-amber-800"
              : "border-black/10 bg-stone-100 text-stone-700")
          }
        >
          <Icon size={20} aria-hidden="true" />
        </span>

        <div className="flex flex-wrap justify-end gap-2">
          <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 text-xs font-bold text-stone-700">
            {enabled ? "Enabled" : "Unavailable"}
          </span>

          {experimental ? (
            <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 text-xs font-bold text-amber-800">
              <FlaskConical size={13} aria-hidden="true" />
              Experimental
            </span>
          ) : null}
        </div>
      </div>

      <h3 className="mt-3 text-sm font-bold text-black">
        {capability?.label || capability?.key || "Capability"}
      </h3>

      <p className="mt-1 text-xs leading-5 text-stone-600">
        {capabilityReasonLabel(reason)}
      </p>

      {capability?.selectionSource ? (
        <p className="mt-3 text-xs font-semibold text-stone-700">
          Source: {capability.selectionSource}
        </p>
      ) : null}

      {Array.isArray(capability?.dependencies) &&
      capability.dependencies.length ? (
        <div className="mt-3">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-stone-600">
            <ShieldAlert size={13} aria-hidden="true" />
            Dependencies
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {capability.dependencies.map((dependency) => (
              <li
                key={dependency}
                className="rounded-full border border-black/10 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700"
              >
                {dependency}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
