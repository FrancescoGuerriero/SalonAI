const LABELS = {
  connected: "Connected",
  attention: "Attention needed",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

export default function ConnectorHealth({
  label,
  state,
  summary = "",
  impact = "",
  lastSuccessfulSyncAt = "",
  affectedCount = null,
  referenceId = "",
  canReconnect = false,
  canViewDiagnostics = false,
  onRequestReconnect,
  onRequestDiagnostics,
}) {
  const disconnected = state === "disconnected";

  return (
    <article
      className={"rounded-xl border p-4 shadow-sm " + (disconnected ? "border-stone-800 bg-stone-900 text-white" : state === "connected" ? "border-amber-300 bg-amber-50 text-black" : "border-black/10 bg-white text-black")}
      data-connector-state={state}
    >
      <span className={"inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold " + (disconnected ? "border-white/20 bg-white/10 text-white" : "border-black/10 bg-white text-black")}>
        {LABELS[state] || state}
      </span>
      <h3 className="mt-3 text-sm font-bold">{label}</h3>
      {summary ? <p className={"mt-1 text-xs leading-5 " + (disconnected ? "text-stone-200" : "text-stone-600")}>{summary}</p> : null}
      {impact ? <p className={"mt-3 text-sm leading-6 " + (disconnected ? "text-stone-100" : "text-stone-700")}>{impact}</p> : null}

      {lastSuccessfulSyncAt || affectedCount !== null || referenceId ? (
        <dl className="mt-4 flex flex-wrap gap-2 text-xs">
          {lastSuccessfulSyncAt ? <div className="rounded-lg border border-current/10 px-2.5 py-1.5"><dt className="sr-only">Last successful sync</dt><dd>Last success · {lastSuccessfulSyncAt}</dd></div> : null}
          {affectedCount !== null ? <div className="rounded-lg border border-current/10 px-2.5 py-1.5"><dt className="sr-only">Affected accounts</dt><dd>{affectedCount} affected</dd></div> : null}
          {referenceId ? <div className="rounded-lg border border-current/10 px-2.5 py-1.5"><dt className="sr-only">Reference ID</dt><dd>Ref · {referenceId}</dd></div> : null}
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canReconnect && onRequestReconnect ? <button type="button" onClick={onRequestReconnect} disabled={state === "reconnecting"} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black bg-amber-400 px-3 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55">{state === "reconnecting" ? "Reconnecting…" : "Reconnect"}</button> : null}
        {canViewDiagnostics && onRequestDiagnostics ? <button type="button" onClick={onRequestDiagnostics} className={"inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 " + (disconnected ? "border-white/40 bg-transparent text-white hover:bg-white/10" : "border-black/15 bg-white text-black hover:bg-stone-100")}>View diagnostics</button> : null}
      </div>
    </article>
  );
}
