export default function ConsultationProgress({
  steps = [],
  currentStep = 1,
  statusText = "",
}) {
  const count = steps.length;
  const safeCurrent = count > 0
    ? Math.min(Math.max(Number(currentStep) || 1, 1), count)
    : 0;

  const announcement = statusText || (
    count > 0 ? `Step ${safeCurrent} of ${count}` : "Consultation progress unavailable"
  );

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5"
      aria-label="Consultation progress"
      data-consultation-current-step={safeCurrent || undefined}
    >
      <p
        className="text-sm font-bold text-stone-800"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>

      {count > 0 ? (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => {
            const position = index + 1;
            const label = typeof step === "string" ? step : step?.label;
            const id = typeof step === "string" ? `${position}-${step}` : step?.id || position;
            const isCurrent = position === safeCurrent;
            const isComplete = position < safeCurrent;

            return (
              <li
                key={id}
                aria-current={isCurrent ? "step" : undefined}
                data-consultation-step-state={
                  isCurrent ? "current" : isComplete ? "complete" : "upcoming"
                }
                className={[
                  "flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                  isCurrent
                    ? "border-amber-500 bg-amber-50 text-black"
                    : "border-black/10 bg-stone-50 text-stone-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-7 min-w-7 items-center justify-center rounded-full border text-xs font-bold",
                    isComplete
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : isCurrent
                        ? "border-amber-600 bg-amber-100 text-amber-900"
                        : "border-black/15 bg-white text-stone-600",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {position}
                </span>
                <span className={isCurrent ? "font-bold" : "font-medium"}>
                  {label || `Step ${position}`}
                </span>
                <span className="sr-only">
                  {isCurrent ? "Current step" : isComplete ? "Completed" : "Not started"}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
