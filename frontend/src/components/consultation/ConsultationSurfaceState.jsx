import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  MessageCircleMore,
  ShieldAlert,
} from "lucide-react";

import Button from "../ui/Button.jsx";

const STATE = {
  loading: {
    title: "Loading consultation",
    description: "Retrieving the latest consultation state.",
    icon: LoaderCircle,
    role: "status",
    live: "polite",
    busy: true,
  },
  incomplete: {
    title: "More information is needed",
    description: "Complete the missing information before continuing the review.",
    icon: CircleHelp,
    role: "status",
    live: "polite",
  },
  error: {
    title: "Your latest change was not saved",
    description: "Keep the entered information and retry only when it is safe to repeat the request.",
    icon: AlertTriangle,
    role: "alert",
    live: "assertive",
  },
  handoff: {
    title: "A stylist is handling this consultation",
    description: "AI replies are paused until an authorised operator explicitly returns the conversation to AI.",
    icon: MessageCircleMore,
    role: "status",
    live: "polite",
  },
  "low-confidence": {
    title: "Human review is required",
    description: "The AI-assisted recommendation is below the configured confidence threshold and must not be treated as a definitive safety decision.",
    icon: ShieldAlert,
    role: "status",
    live: "polite",
  },
  complete: {
    title: "Consultation complete",
    description: "The reviewed outcome is ready for the next authorised step.",
    icon: CheckCircle2,
    role: "status",
    live: "polite",
  },
};

export default function ConsultationSurfaceState({
  state = "loading",
  title = "",
  description = "",
  actionLabel = "",
  onRequestAction,
}) {
  const presentation = STATE[state] || STATE.error;
  const Icon = presentation.icon;
  const isCritical = state === "error" || state === "low-confidence";

  return (
    <section
      className={[
        "rounded-2xl border p-5 shadow-sm sm:p-6",
        isCritical
          ? "border-amber-300 bg-amber-50"
          : "border-black/10 bg-white",
      ].join(" ")}
      data-consultation-state={state}
      role={presentation.role}
      aria-live={presentation.live}
      aria-atomic="true"
      aria-busy={presentation.busy || undefined}
    >
      <span
        className={[
          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border",
          isCritical
            ? "border-amber-300 bg-white text-amber-800"
            : "border-black/10 bg-stone-50 text-stone-700",
        ].join(" ")}
      >
        <Icon
          size={20}
          aria-hidden="true"
          className={state === "loading" ? "app-spin" : ""}
        />
      </span>

      <h2 className="mt-4 text-lg font-bold text-black">
        {title || presentation.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
        {description || presentation.description}
      </p>

      {onRequestAction && actionLabel ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-5 min-h-11"
          onClick={onRequestAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
