const STATES = {
  enabled: ["Enabled", "border-amber-300 bg-amber-50", "border-amber-300 bg-white text-amber-800", false],
  off: ["Available — off", "border-black/10 bg-white", "border-black/10 bg-stone-100 text-black", false],
  "not-included": ["Not included", "border-stone-800 bg-stone-900", "border-white/20 bg-white/10 text-white", true],
  "no-access": ["No access", "border-black/10 bg-stone-100", "border-black/10 bg-white text-black", false],
};

export default function CapabilityStatus({
  label,
  state,
  reason = "",
  canChangeState = false,
  onRequestEnable,
}) {
  const [statusLabel, shell, badge, inverse] =
    STATES[state] || STATES["no-access"];

  return (
    <article
      className={"rounded-xl border p-4 shadow-sm " + shell}
      data-capability-state={state}
    >
      <span className={"inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold " + badge}>
        {statusLabel}
      </span>
      <h3 className={"mt-3 text-sm font-bold " + (inverse ? "text-white" : "text-black")}>
        {label}
      </h3>
      {reason ? (
        <p className={"mt-1 text-xs leading-5 " + (inverse ? "text-stone-200" : "text-stone-600")}>
          {reason}
        </p>
      ) : null}
      {state === "off" && canChangeState && onRequestEnable ? (
        <button
          type="button"
          onClick={onRequestEnable}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-400 bg-white px-3 text-sm font-bold text-black hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Turn on
        </button>
      ) : null}
    </article>
  );
}
