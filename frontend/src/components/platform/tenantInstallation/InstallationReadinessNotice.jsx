const STATE_COPY = Object.freeze({
  ready: {
    title: "Ready for review",
    detail: "The supplied installation plan is current and has no blocking state.",
  },
  stale: {
    title: "Dry-run result is stale",
    detail: "Request a fresh server-generated dry run before relying on this installation plan.",
  },
  unavailable: {
    title: "Provisioning runtime unavailable",
    detail: "Installation planning cannot continue until the authoritative provisioning runtime is available.",
  },
  "partially-blocked": {
    title: "Installation partially blocked",
    detail: "Some installation work remains blocked. Review the supplied blockers before requesting any write operation.",
  },
  blocked: {
    title: "Installation blocked",
    detail: "The authoritative plan contains blocking conditions that must be resolved before write mode can be requested.",
  },
});

export default function InstallationReadinessNotice({
  state = "ready",
  detail = "",
  referenceId = "",
  actionLabel = "",
  actionAllowed = false,
  onRequestAction,
}) {
  const key = STATE_COPY[state] ? state : "blocked";
  const copy = STATE_COPY[key];
  const canRequestAction =
    actionAllowed &&
    actionLabel &&
    typeof onRequestAction === "function";

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      role={key === "ready" ? "status" : "alert"}
      aria-labelledby="installation-readiness-title"
      data-installation-readiness={key}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Installation readiness
          </p>
          <h2
            id="installation-readiness-title"
            className="mt-1 text-lg font-bold text-black"
          >
            {copy.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
            {detail || copy.detail}
          </p>
          {referenceId ? (
            <p className="mt-2 break-all text-xs font-semibold text-stone-600">
              Reference: {referenceId}
            </p>
          ) : null}
        </div>

        <span className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-black/10 bg-stone-100 px-2.5 text-xs font-bold text-stone-700">
          {key === "ready" ? "Current" : "Attention required"}
        </span>
      </div>

      {canRequestAction ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRequestAction}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black bg-white px-4 py-2 text-sm font-bold text-black hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
