const STATUS_LABELS = {
  complete: "Complete",
  current: "Current",
  blocked: "Blocked",
  warning: "Attention required",
  pending: "Pending",
};

function normaliseSteps(steps) {
  return Array.isArray(steps) ? steps : [];
}

export default function InstallationStepper({
  steps,
  currentStepId,
  onRequestStep,
  ariaLabel = "Tenant installation progress",
}) {
  const values = normaliseSteps(steps);

  if (!values.length) {
    return null;
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
    >
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {values.map((step, index) => {
          const id = step?.id || `installation-step-${index + 1}`;
          const label = step?.label || `Step ${index + 1}`;
          const current = id === currentStepId || step?.status === "current";
          const status = current ? "current" : String(step?.status || "pending");
          const statusLabel = STATUS_LABELS[status] || status;
          const canRequest =
            typeof onRequestStep === "function" &&
            step?.disabled !== true &&
            status !== "blocked";

          const content = (
            <>
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Step {index + 1}
              </span>
              <span className="mt-1 block text-sm font-bold text-black">
                {label}
              </span>
              <span className="mt-1 block text-xs text-stone-600">
                {statusLabel}
              </span>
            </>
          );

          return (
            <li key={id}>
              {canRequest ? (
                <button
                  type="button"
                  onClick={() => onRequestStep(id)}
                  aria-current={current ? "step" : undefined}
                  className="min-h-11 w-full rounded-xl border border-black/10 bg-stone-50 px-3 py-2 text-left transition hover:border-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={current ? "step" : undefined}
                  aria-disabled={
                    step?.disabled === true || status === "blocked"
                      ? "true"
                      : undefined
                  }
                  className="min-h-11 rounded-xl border border-black/10 bg-stone-50 px-3 py-2"
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
