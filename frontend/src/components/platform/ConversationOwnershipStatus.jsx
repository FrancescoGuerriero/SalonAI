import { Bot, Hand, Loader2, UserRoundCheck } from "lucide-react";

export default function ConversationOwnershipStatus({
  mode = "bot",
  handoffRequested = false,
  handoffReason = "",
  assignedToLabel = "",
  canResumeBot = false,
  resumePending = false,
  onRequestResumeBot,
}) {
  const human = mode === "human";
  const awaitingHuman = !human && handoffRequested;

  let title = "AI handling";
  let description =
    "Automation currently owns the WhatsApp conversation.";

  if (human) {
    title = "Human handling";
    description = assignedToLabel
      ? assignedToLabel + " currently owns this conversation."
      : "A staff member currently owns this conversation.";
  } else if (awaitingHuman) {
    title = "Human handoff requested";
    description = handoffReason
      ? handoffReason
      : "Automation requested staff ownership of this conversation.";
  }

  const Icon = human
    ? UserRoundCheck
    : awaitingHuman
      ? Hand
      : Bot;

  return (
    <section
      className={
        "rounded-xl border p-4 shadow-sm " +
        (
          human
            ? "border-black/15 bg-white"
            : awaitingHuman
              ? "border-amber-300 bg-amber-50"
              : "border-amber-300 bg-white"
        )
      }
      data-conversation-owner={
        human ? "human" : awaitingHuman ? "handoff-requested" : "bot"
      }
      aria-live="polite"
      aria-busy={resumePending ? "true" : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
          <Icon size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
            Conversation ownership
          </p>
          <h3 className="mt-1 text-sm font-bold text-black">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            {description}
          </p>
        </div>
      </div>

      {human && canResumeBot && onRequestResumeBot ? (
        <button
          type="button"
          onClick={onRequestResumeBot}
          disabled={resumePending}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {resumePending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Bot size={16} aria-hidden="true" />
          )}
          {resumePending ? "Returning to AI…" : "Return to AI"}
        </button>
      ) : null}
    </section>
  );
}
