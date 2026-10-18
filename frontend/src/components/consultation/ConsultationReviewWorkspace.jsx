import Button from "../ui/Button.jsx";

function DetailList({ items = [], emptyLabel = "No information supplied" }) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-500">{emptyLabel}</p>;
  }

  return (
    <dl className="divide-y divide-black/10">
      {items.map((item, index) => (
        <div
          key={item?.id || item?.label || index}
          className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4"
        >
          <dt className="text-sm font-bold text-stone-600">
            {item?.label || "Detail"}
          </dt>
          <dd className="text-sm leading-6 text-stone-900">
            {item?.value || "Not supplied"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ConsultationReviewWorkspace({
  title = "Consultation review",
  customerLabel = "",
  channelLabel = "",
  statusLabel = "Human review required",
  summaryItems = [],
  answers = [],
  recommendation = null,
  flags = [],
  actions = [],
  busyAction = "",
}) {
  const availableActions = actions.filter(
    (action) => action?.label && typeof action?.onRequest === "function"
  );
  const isBusy = Boolean(busyAction);

  return (
    <section
      className="rounded-2xl border border-black/10 bg-stone-50 p-4 shadow-sm sm:p-6"
      aria-busy={isBusy || undefined}
      data-consultation-review-workspace="true"
    >
      <header className="flex flex-col gap-3 border-b border-black/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            {statusLabel}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-black">{title}</h2>
          {customerLabel || channelLabel ? (
            <p className="mt-2 text-sm text-stone-600">
              {[customerLabel, channelLabel].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-black/10 bg-white p-5">
          <h3 className="text-lg font-bold text-black">Consultation summary</h3>
          <div className="mt-3">
            <DetailList items={summaryItems} />
          </div>
        </aside>

        <div className="grid min-w-0 gap-5">
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-black">
                AI-assisted recommendation
              </h3>
              {recommendation?.confidenceLabel ? (
                <span className="w-fit rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900">
                  {recommendation.confidenceLabel}
                </span>
              ) : null}
            </div>

            {recommendation?.title ? (
              <p className="mt-3 text-base font-bold leading-6 text-black">
                {recommendation.title}
              </p>
            ) : (
              <p className="mt-3 text-sm text-stone-600">
                No recommendation is currently available.
              </p>
            )}

            {recommendation?.rationale ? (
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {recommendation.rationale}
              </p>
            ) : null}

            <p className="mt-3 text-xs leading-5 text-stone-600">
              Advisory only. Deterministic safety and business rules, plus authorised human review where required, remain authoritative.
            </p>
          </article>

          {flags.length > 0 ? (
            <section className="rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="consultation-flags-title">
              <h3 id="consultation-flags-title" className="text-lg font-bold text-black">
                Attention required
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {flags.map((flag, index) => {
                  const label = typeof flag === "string" ? flag : flag?.label;
                  return (
                    <li
                      key={(typeof flag === "object" && flag?.id) || label || index}
                      className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
                    >
                      {label || "Review required"}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="consultation-evidence-title">
            <h3 id="consultation-evidence-title" className="text-lg font-bold text-black">
              Structured answers and evidence
            </h3>
            <div className="mt-3">
              <DetailList items={answers} emptyLabel="No structured answers are available yet" />
            </div>
          </section>

          {availableActions.length > 0 ? (
            <section className="rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="consultation-actions-title">
              <h3 id="consultation-actions-title" className="text-lg font-bold text-black">
                Human decision
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Only actions supplied by authoritative application state are shown here. This presentation layer does not infer permissions or mutate consultation state by itself.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {availableActions.map((action) => {
                  const actionId = action.id || action.label;
                  const isActionBusy = busyAction === actionId;

                  return (
                    <Button
                      key={actionId}
                      type="button"
                      variant={action.variant || "secondary"}
                      className="min-h-11"
                      loading={isActionBusy}
                      disabled={isBusy || action.disabled}
                      onClick={action.onRequest}
                    >
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {isBusy ? (
        <p className="sr-only" role="status" aria-live="polite">
          Consultation action in progress
        </p>
      ) : null}
    </section>
  );
}
