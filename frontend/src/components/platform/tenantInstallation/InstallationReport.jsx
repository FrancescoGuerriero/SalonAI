import { AlertTriangle, CircleCheck, CircleOff, RotateCcw, CirclePlus } from "lucide-react";

const GROUPS = [
  ["created", "Created", CirclePlus],
  ["reused", "Reused", RotateCcw],
  ["skipped", "Skipped", CircleOff],
  ["blocked", "Blocked", AlertTriangle],
  ["warnings", "Warnings", AlertTriangle],
  ["unresolvedDependencies", "Unresolved dependencies", AlertTriangle],
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function itemLabel(item) {
  if (typeof item === "string") return item;
  return item?.label || item?.title || item?.resource || item?.dependency || "Report item";
}

function itemDetail(item) {
  if (typeof item === "string") return "";
  return item?.detail || item?.reason || item?.code || "";
}

export default function InstallationReport({ report }) {
  const groups = GROUPS.map(([key, label, Icon]) => ({
    key,
    label,
    Icon,
    items: asArray(report?.[key]),
  }));
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const ready = Boolean(report?.activationReady);
  const referenceId = String(report?.referenceId || report?.auditReferenceId || "").trim();

  const summary = [
    `Installation report: ${totalItems} reported items.`,
    ...groups.map((group) => `${group.items.length} ${group.label.toLowerCase()}.`),
    ready ? "Activation ready." : "Not activation ready.",
    referenceId ? `Reference ${referenceId}.` : "",
  ].filter(Boolean).join(" ");

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="installation-report-title"
      data-installation-report-readiness={ready ? "ready" : "not-ready"}
    >
      <p className="sr-only" aria-live="polite">{summary}</p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Provisioning evidence</p>
          <h2 id="installation-report-title" className="mt-1 text-lg font-bold text-black">Installation report</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
            Presentation of the future server-generated machine-readable report. No provisioning write is executed by this view.
          </p>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-stone-100 px-2.5 text-xs font-bold text-stone-700">
          {ready ? "Activation-ready" : "Not activation-ready"}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {groups.map((group) => (
          <div key={group.key} className="rounded-xl border border-black/10 bg-stone-50 p-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">{group.label}</dt>
            <dd className="mt-1 text-xl font-bold text-black">{group.items.length}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-5">
        {groups.map(({ key, label, Icon, items }) => items.length ? (
          <section key={key} aria-label={`${label} report items`}>
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
              <Icon size={14} aria-hidden="true" />
              {label} · {items.length}
            </h3>
            <ul className="mt-2 space-y-2">
              {items.map((item, index) => {
                const labelText = itemLabel(item);
                const detail = itemDetail(item);
                return (
                  <li key={`${key}-${item?.id || labelText}-${index}`} className="rounded-xl border border-black/10 bg-white p-3">
                    <p className="text-sm font-bold text-black">{labelText}</p>
                    {detail ? <p className="mt-1 text-xs leading-5 text-stone-600">{detail}</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null)}
      </div>

      {!totalItems ? (
        <p className="mt-5 rounded-xl border border-dashed border-black/15 bg-stone-50 p-4 text-sm text-stone-600">
          No installation report items were supplied.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-stone-50 p-3 text-xs text-stone-700">
        {ready ? <CircleCheck size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
        <strong className="font-bold text-black">{ready ? "Activation-ready" : "Not activation-ready"}</strong>
        {referenceId ? <span>Reference: {referenceId}</span> : null}
      </div>
    </section>
  );
}
