import { LockKeyhole, RotateCcw } from "lucide-react";

export default function EffectiveConfigurationRow({
  label,
  displayValue,
  sourceLabel,
  inherited = false,
  locked = false,
  canOverride = false,
  canRevert = false,
  onRequestOverride,
  onRequestRevert,
}) {
  return (
    <article className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-black">{label}</h3>
            {locked ? (
              <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-black/10 bg-stone-100 px-2 text-xs font-bold text-stone-700">
                <LockKeyhole size={13} aria-hidden="true" />
                Locked
              </span>
            ) : inherited ? (
              <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-bold text-amber-800">
                Inherited
              </span>
            ) : (
              <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-white px-2 text-xs font-bold text-amber-800">
                Override
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-600">
            Source: {sourceLabel || "Authoritative configuration"}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:items-end">
          <strong className="break-words text-base text-black">{displayValue}</strong>
          <div className="flex flex-wrap gap-2">
            {canOverride && !locked && onRequestOverride ? (
              <button
                type="button"
                onClick={onRequestOverride}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-black/15 bg-white px-3 text-sm font-bold text-black hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                Override here
              </button>
            ) : null}
            {canRevert && !locked && onRequestRevert ? (
              <button
                type="button"
                onClick={onRequestRevert}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-sm font-bold text-black hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <RotateCcw size={15} aria-hidden="true" />
                Revert to inherited
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
