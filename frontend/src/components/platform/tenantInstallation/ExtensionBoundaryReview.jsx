import { AlertTriangle, Boxes, Building2, Layers3, SlidersHorizontal } from "lucide-react";

const CLASSIFICATIONS = {
  configuration: {
    label: "Existing configuration",
    description: "Use tenant configuration when the platform already exposes the required behaviour safely.",
    Icon: SlidersHorizontal,
  },
  "reusable-module": {
    label: "Reusable module",
    description: "Build a reusable platform capability when the requirement is valuable across multiple tenants or verticals.",
    Icon: Boxes,
  },
  "vertical-extension": {
    label: "Vertical extension",
    description: "Use a governed vertical extension when the requirement belongs to a defined industry pack.",
    Icon: Layers3,
  },
  "governed-tenant-extension": {
    label: "Governed tenant extension",
    description: "Use a governed tenant extension only when the requirement is genuinely business-specific and cannot be represented safely elsewhere.",
    Icon: Building2,
  },
};

function normaliseRequirement(requirement) {
  if (!requirement || typeof requirement !== "object") return null;
  const classification = CLASSIFICATIONS[requirement.classification]
    ? requirement.classification
    : "governed-tenant-extension";

  return {
    ...requirement,
    classification,
    title: requirement.title || requirement.label || "Custom requirement",
  };
}

export default function ExtensionBoundaryReview({ requirements = [] }) {
  const items = Array.isArray(requirements)
    ? requirements.map(normaliseRequirement).filter(Boolean)
    : [];

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="extension-boundary-title"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Extension governance</p>
      <h2 id="extension-boundary-title" className="mt-1 text-lg font-bold text-black">Extension boundary review</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
        Classifications are supplied by the platform workflow for review. This view does not decide architecture or generate tenant-specific source code.
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="note">
        <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
        <p><strong>Tenant code fork is not an installation option.</strong> Prefer platform configuration, reusable capability, vertical extension or a governed tenant extension.</p>
      </div>

      {items.length ? (
        <ul className="mt-5 space-y-3">
          {items.map((item, index) => {
            const presentation = CLASSIFICATIONS[item.classification];
            const Icon = presentation.Icon;
            return (
              <li
                key={item.id || `${item.classification}-${index}`}
                className="rounded-xl border border-black/10 bg-stone-50 p-4"
                data-extension-classification={item.classification}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-black">{item.title}</p>
                    {item.detail ? <p className="mt-1 text-xs leading-5 text-stone-600">{item.detail}</p> : null}
                  </div>
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 text-xs font-bold text-stone-700">
                    <Icon size={14} aria-hidden="true" />
                    {presentation.label}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-stone-600">{presentation.description}</p>
                {item.provenance ? <p className="mt-2 text-xs font-medium text-stone-700">Source: {item.provenance}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-black/15 bg-stone-50 p-4 text-sm text-stone-600">
          No governed extension requirements were supplied.
        </p>
      )}
    </section>
  );
}
