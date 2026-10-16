import { Bot, Hand, Loader2, UserRoundCheck } from "lucide-react";

function ownershipState(conversation = {}) {
  const automation = conversation.automation || {};
  const human = automation.mode === "human";
  const handoffRequested = !human && Boolean(automation.handoffRequested);

  if (human) {
    return {
      key: "human",
      title: "Human handling",
      description: automation.handoffReason ||
        "A staff member currently owns this WhatsApp conversation.",
      Icon: UserRoundCheck,
    };
  }

  if (handoffRequested) {
    return {
      key: "handoff-requested",
      title: "Human handoff requested",
      description: automation.handoffReason ||
        "The WhatsApp automation requested staff ownership.",
      Icon: Hand,
    };
  }

  return {
    key: "bot",
    title: "AI handling",
    description: "WhatsApp automation currently owns this conversation.",
    Icon: Bot,
  };
}

export default function WhatsAppConversationOwnershipControl({
  conversation,
  canResumeBot = false,
  resumePending = false,
  onRequestResumeBot,
}) {
  if (!conversation) {
    return null;
  }

  const state = ownershipState(conversation);
  const Icon = state.Icon;
  const showResume =
    state.key === "human" &&
    canResumeBot &&
    typeof onRequestResumeBot === "function";

  return (
    <section
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
      aria-labelledby="whatsapp-ownership-title"
      data-conversation-owner={state.key}
      aria-busy={resumePending ? "true" : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
          <Icon size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Conversation ownership
          </p>
          <h3 id="whatsapp-ownership-title" className="mt-1 text-sm font-bold text-slate-900">
            {state.title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {state.description}
          </p>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {resumePending
          ? "Returning this WhatsApp conversation to AI handling."
          : `${state.title}. ${state.description}`}
      </p>

      {showResume ? (
        <button
          type="button"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-900 bg-amber-400 px-4 text-sm font-bold text-slate-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          onClick={onRequestResumeBot}
          disabled={resumePending}
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
