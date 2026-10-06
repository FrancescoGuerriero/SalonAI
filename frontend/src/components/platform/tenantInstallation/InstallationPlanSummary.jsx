import {
  AlertTriangle,
  CircleCheck,
  CircleOff,
  CirclePlus,
  RotateCcw,
} from "lucide-react";

const RESULT_PRESENTATION = {
  create: {
    label: "CREATE",
    icon: CirclePlus,
    className: "border-amber-300 bg-amber-50 text-amber-800",
  },
  reuse: {
    label: "REUSE",
    icon: RotateCcw,
    className: "border-black/10 bg-white text-black",
  },
  skip: {
    label: "SKIP",
    icon: CircleOff,
    className: "border-black/10 bg-stone-100 text-stone-700",
  },
  blocked: {
    label: "BLOCKED",
    icon: AlertTriangle,
    className: "border-stone-800 bg-stone-900 text-white",
  },
  warning: {
    label: "WARNING",
    icon: AlertTriangle,
    className: "border-black/15 bg-white text-black",
  },
};

function normaliseItems(value) {
  return Array.isArray(value) ? value : [];
}

function ResultGroup({
  state,
  items,
}) {
  const values = normaliseItems(items);

  if (!values.length) {
    return null;
  }

  const presentation =
    RESULT_PRESENTATION[state] ||
    RESULT_PRESENTATION.warning;
  const Icon = presentation.icon;

  return (
    <section aria-label={presentation.label + " installation results"}>
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
        <Icon size={14} aria-hidden="true" />
        {presentation.label} · {values.length}
      </h3>

      <ul className="mt-2 space-y-2">
        {values.map((item, index) => {
          const label =
            typeof item === "string"
              ? item
              : item?.label ||
                item?.resource ||
                item?.title ||
                "Installation item";

          const detail =
            typeof item === "string"
              ? ""
              : item?.detail ||
                item?.reason ||
                "";

          return (
            <li
              key={(item?.id || label) + "-" + index}
              className="rounded-xl border border-black/10 bg-white p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-bold text-black">
                  {label}
                </p>
                <span
                  className={
                    "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold " +
                    presentation.className
                  }
                >
                  {presentation.label}
                </span>
              </div>

              {detail ? (
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  {detail}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function InstallationPlanSummary({
  plan,
}) {
  const mode = String(plan?.mode || "dry-run");
  const status = String(plan?.status || "review");
  const created = normaliseItems(plan?.created);
  const reused = normaliseItems(plan?.reused);
  const skipped = normaliseItems(plan?.skipped);
  const blocked = normaliseItems(plan?.blocked);
  const warnings = normaliseItems(plan?.warnings);

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="installation-plan-summary-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Tenant installation plan
          </p>
          <h2
            id="installation-plan-summary-title"
            className="mt-1 text-lg font-bold text-black"
          >
            {mode === "dry-run"
              ? "Dry-run review"
              : "Installation result"}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-800">
            {mode}
          </span>
          <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-stone-100 px-2.5 text-xs font-bold text-stone-700">
            {status}
          </span>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Create", created.length],
          ["Reuse", reused.length],
          ["Skip", skipped.length],
          ["Blocked", blocked.length],
          ["Warnings", warnings.length],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-black/10 bg-stone-50 p-3"
          >
            <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
              {label}
            </dt>
            <dd className="mt-1 text-xl font-bold text-black">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 space-y-5">
        <ResultGroup state="create" items={created} />
        <ResultGroup state="reuse" items={reused} />
        <ResultGroup state="skip" items={skipped} />
        <ResultGroup state="blocked" items={blocked} />
        <ResultGroup state="warning" items={warnings} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-stone-50 p-3 text-xs text-stone-700">
        {plan?.activationReady ? (
          <>
            <CircleCheck size={15} aria-hidden="true" />
            <strong className="font-bold text-black">
              Activation-ready
            </strong>
          </>
        ) : (
          <>
            <AlertTriangle size={15} aria-hidden="true" />
            <strong className="font-bold text-black">
              Not activation-ready
            </strong>
          </>
        )}

        {plan?.referenceId ? (
          <span>Reference: {plan.referenceId}</span>
        ) : null}
      </div>
    </section>
  );
}
