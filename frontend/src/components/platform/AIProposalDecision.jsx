const LABELS = {
  review: "Review required",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export default function AIProposalDecision({
  state = "review",
  title,
  reason = "",
  scopeLabel = "",
  expectedEffect = "",
  uncertainty = "",
  evidence = [],
  canApprove = false,
  canReject = false,
  onRequestApprove,
  onRequestReject,
}) {
  const review = state === "review";

  return (
    <article
      className={"rounded-xl border bg-white p-4 shadow-sm " + (review ? "border-amber-300" : "border-black/10")}
      data-proposal-state={state}
    >
      <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold uppercase tracking-wide text-amber-800">
        {LABELS[state] || state}
      </span>
      <h3 className="mt-3 text-base font-bold text-black">{title}</h3>
      {reason ? <p className="mt-2 text-sm leading-6 text-stone-600">{reason}</p> : null}

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {scopeLabel ? <div className="rounded-lg border border-black/10 bg-stone-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-stone-600">Scope</dt><dd className="mt-1 text-sm font-semibold text-black">{scopeLabel}</dd></div> : null}
        {expectedEffect ? <div className="rounded-lg border border-black/10 bg-stone-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-stone-600">Expected effect</dt><dd className="mt-1 text-sm font-semibold text-black">{expectedEffect}</dd></div> : null}
        {uncertainty ? <div className="rounded-lg border border-black/10 bg-stone-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-stone-600">Uncertainty</dt><dd className="mt-1 text-sm font-semibold text-black">{uncertainty}</dd></div> : null}
      </dl>

      {evidence.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-600">Evidence reviewed</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {evidence.map((item) => (
              <li key={item.id || item.label} className="rounded-full border border-black/10 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
                {item.label}{item.period ? " · " + item.period : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {review ? (
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {canReject && onRequestReject ? <button type="button" onClick={onRequestReject} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/15 bg-white px-4 text-sm font-bold text-black hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">Reject</button> : null}
          {canApprove && onRequestApprove ? <button type="button" onClick={onRequestApprove} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">Approve proposal</button> : null}
        </div>
      ) : null}
    </article>
  );
}
