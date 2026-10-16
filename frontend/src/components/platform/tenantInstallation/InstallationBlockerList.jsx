import { AlertTriangle, CircleAlert } from "lucide-react";

export default function InstallationBlockerList({
  blockers = [],
  warnings = [],
  onRequestAction,
}) {
  const safeBlockers = Array.isArray(blockers) ? blockers : [];
  const safeWarnings = Array.isArray(warnings) ? warnings : [];

  if (!safeBlockers.length && !safeWarnings.length) {
    return (
      <section
        className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
        role="status"
      >
        <p className="text-sm font-bold text-black">
          No installation blockers were supplied.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="installation-blockers-title"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
        Recovery
      </p>
      <h2
        id="installation-blockers-title"
        className="mt-1 text-lg font-bold text-black"
      >
        Installation blockers and warnings
      </h2>

      <div className="mt-4 space-y-3">
        {safeBlockers.map((item, index) => (
          <article
            key={(item?.code || item?.title || "blocker") + "-" + index}
            className="rounded-xl border border-stone-800 bg-stone-900 p-4 text-white"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {item?.title || "Installation blocked"}
                </p>
                {item?.detail || item?.reason ? (
                  <p className="mt-1 text-xs leading-5 text-stone-200">
                    {item.detail || item.reason}
                  </p>
                ) : null}

                {item?.code ? (
                  <p className="mt-2 text-xs font-semibold text-stone-300">
                    {item.code}
                  </p>
                ) : null}
              </div>
            </div>

            {item?.actionLabel &&
            typeof onRequestAction === "function" ? (
              <button
                type="button"
                onClick={() => onRequestAction(item)}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-white/40 bg-transparent px-4 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
              >
                {item.actionLabel}
              </button>
            ) : null}
          </article>
        ))}

        {safeWarnings.map((item, index) => (
          <article
            key={(item?.code || item?.title || "warning") + "-" + index}
            className="rounded-xl border border-amber-300 bg-amber-50 p-4"
          >
            <div className="flex items-start gap-3">
              <CircleAlert
                size={18}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-amber-800"
              />
              <div>
                <p className="text-sm font-bold text-black">
                  {item?.title || "Installation warning"}
                </p>
                {item?.detail || item?.reason ? (
                  <p className="mt-1 text-xs leading-5 text-stone-700">
                    {item.detail || item.reason}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
