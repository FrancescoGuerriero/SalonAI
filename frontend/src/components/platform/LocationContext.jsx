import { Building2, ChevronDown, MapPin } from "lucide-react";

const STATE_COPY = {
  default: null,
  open: "Location menu open",
  loading: "Loading location…",
  error: "Location unavailable",
};

export default function LocationContext({
  businessName = "",
  locationName = "",
  locationSubtitle = "",
  state = "default",
  open = false,
  disabled = false,
  onRequestOpen,
}) {
  const loading = state === "loading";
  const error = state === "error";
  const displayLocation =
    STATE_COPY[state] || locationName || "Location not selected";

  return (
    <section
      className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
      aria-label="Current business and location context"
    >
      <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold uppercase tracking-wide text-amber-800">
        <MapPin size={16} aria-hidden="true" />
        Active location
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-stone-600">
          <Building2 size={14} aria-hidden="true" />
          <span className="truncate">
            {businessName || "Business context"}
          </span>
        </div>

        <p
          className="mt-1 truncate text-sm font-bold text-black"
          aria-live="polite"
          aria-atomic="true"
        >
          {displayLocation}
        </p>

        {!loading && !error && locationSubtitle ? (
          <p className="mt-0.5 truncate text-xs text-stone-600">
            {locationSubtitle}
          </p>
        ) : null}

        {error ? (
          <p className="mt-0.5 text-xs font-semibold text-stone-700">
            Choose a safe permitted location.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onRequestOpen}
        disabled={disabled || loading || !onRequestOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          error
            ? "Choose a permitted location"
            : "Change active location"
        }
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-sm font-bold text-black hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span className="hidden sm:inline">
          {error ? "Choose location" : "Change"}
        </span>
        <ChevronDown
          size={17}
          aria-hidden="true"
          className={open ? "rotate-180" : ""}
        />
      </button>
    </section>
  );
}
