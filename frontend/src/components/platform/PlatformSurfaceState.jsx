import {
  AlertTriangle,
  Ban,
  Inbox,
  LockKeyhole,
  PackageX,
  RefreshCw,
} from "lucide-react";

const STATE = {
  "permission-denied": {
    title: "You do not have access",
    description:
      "Your current effective authority does not allow this action or surface.",
    icon: Ban,
  },
  locked: {
    title: "This setting is locked",
    description:
      "A higher-level configuration currently prevents changes at this scope.",
    icon: LockKeyhole,
  },
  "plan-unavailable": {
    title: "Not included in this capability pack",
    description:
      "This capability is not available for the current business entitlement.",
    icon: PackageX,
  },
  error: {
    title: "This information could not be loaded",
    description:
      "The request failed. Retry only when it is safe to repeat the operation.",
    icon: AlertTriangle,
  },
  empty: {
    title: "Nothing here yet",
    description:
      "There is no information to show for the current authorised scope.",
    icon: Inbox,
  },
};

export default function PlatformSurfaceState({
  state,
  title,
  description,
  actionLabel = "",
  onRequestAction,
}) {
  const presentation = STATE[state] || STATE.error;
  const Icon = presentation.icon;
  const retry = state === "error" && onRequestAction;

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 text-center shadow-sm sm:p-6"
      data-platform-surface-state={state}
      role={state === "error" ? "alert" : "status"}
    >
      <span className="mx-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
        <Icon size={20} aria-hidden="true" />
      </span>

      <h2 className="mt-4 text-lg font-bold text-black">
        {title || presentation.title}
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
        {description || presentation.description}
      </p>

      {onRequestAction && actionLabel ? (
        <button
          type="button"
          onClick={onRequestAction}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/15 bg-white px-4 text-sm font-bold text-black hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          {retry ? <RefreshCw size={16} aria-hidden="true" /> : null}
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
