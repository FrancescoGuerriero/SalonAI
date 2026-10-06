import { CircleCheck, CircleOff, LockKeyhole } from "lucide-react";

function normaliseVerticals(value) {
  return Array.isArray(value) ? value : [];
}

export default function VerticalPackSelector({
  verticals = [],
  selectedVerticalId = "",
  onRequestSelect,
  disabled = false,
  title = "Vertical pack",
}) {
  const safeVerticals = normaliseVerticals(verticals);

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="tenant-installation-vertical-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Product composition
          </p>
          <h2
            id="tenant-installation-vertical-title"
            className="mt-1 text-lg font-bold text-black"
          >
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Choose from server-supplied registered vertical packs. This control
            requests a selection only; it does not create or activate a tenant.
          </p>
        </div>

        <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-stone-100 px-2.5 text-xs font-bold text-stone-700">
          Registry supplied
        </span>
      </div>

      {safeVerticals.length ? (
        <div
          className="mt-5 grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Available vertical packs"
        >
          {safeVerticals.map((vertical, index) => {
            const id = String(vertical?.id || vertical?.verticalId || index);
            const selected = id === String(selectedVerticalId || "");
            const available = vertical?.available !== false;
            const locked = vertical?.locked === true;
            const optionDisabled = disabled || !available || locked;
            const label = vertical?.label || vertical?.name || id;
            const description = vertical?.description || "";

            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={optionDisabled}
                disabled={optionDisabled}
                onClick={() => {
                  if (
                    !optionDisabled &&
                    typeof onRequestSelect === "function"
                  ) {
                    onRequestSelect(vertical);
                  }
                }}
                className={
                  "min-h-24 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 " +
                  (selected
                    ? "border-amber-700 bg-amber-50"
                    : "border-black/10 bg-white hover:border-amber-500") +
                  (optionDisabled
                    ? " cursor-not-allowed opacity-60"
                    : " cursor-pointer")
                }
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-black">
                      {label}
                    </span>
                    {description ? (
                      <span className="mt-1 block text-xs leading-5 text-stone-600">
                        {description}
                      </span>
                    ) : null}
                  </span>

                  {locked ? (
                    <LockKeyhole
                      size={18}
                      aria-label="Locked"
                      className="shrink-0 text-stone-700"
                    />
                  ) : available ? (
                    selected ? (
                      <CircleCheck
                        size={18}
                        aria-label="Selected"
                        className="shrink-0 text-amber-800"
                      />
                    ) : null
                  ) : (
                    <CircleOff
                      size={18}
                      aria-label="Unavailable"
                      className="shrink-0 text-stone-600"
                    />
                  )}
                </span>

                <span className="mt-3 flex flex-wrap gap-2">
                  {vertical?.classification ? (
                    <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-stone-100 px-2.5 text-xs font-bold text-stone-700">
                      {vertical.classification}
                    </span>
                  ) : null}
                  {vertical?.version ? (
                    <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-white px-2.5 text-xs font-semibold text-stone-700">
                      v{vertical.version}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-700">
          No registered vertical packs were supplied.
        </div>
      )}
    </section>
  );
}
