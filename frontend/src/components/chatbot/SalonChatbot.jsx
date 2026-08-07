import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Bot,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { sendChatbotMessage } from "../../Services/chatbotService.js";
import "../../styles/chatbot.css";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  text:
    "Hello! I’m the SalonAI assistant. I can help with services, stylists, bookings, haircare guidance, and salon support.",
  quickReplies: [
    "Book an appointment",
    "View services",
    "Meet the stylists",
    "Haircare advice",
  ],
  actions: [],
};

const FALLBACK_MESSAGE = {
  text:
    "I can’t reach the salon assistant just now. You can still browse services, start a booking, or open the Help centre.",
  quickReplies: [],
  actions: [
    { label: "View services", to: "/services" },
    { label: "Get help", to: "/help" },
  ],
};

function messageId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function SalonChatbot() {
  const titleId = useId();
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    inputRef.current?.focus();

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);

    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  async function submitMessage(value) {
    const text = String(value || "").trim();

    if (!text || sending) {
      return;
    }

    setInput("");
    setMessages((current) => [
      ...current,
      {
        id: messageId("user"),
        role: "user",
        text,
        quickReplies: [],
        actions: [],
      },
    ]);
    setSending(true);

    try {
      const result = await sendChatbotMessage(text);

      setMessages((current) => [
        ...current,
        {
          id: messageId("assistant"),
          role: "assistant",
          text: result?.reply || FALLBACK_MESSAGE.text,
          quickReplies: Array.isArray(result?.quickReplies)
            ? result.quickReplies
            : [],
          actions: Array.isArray(result?.actions)
            ? result.actions
            : FALLBACK_MESSAGE.actions,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: messageId("assistant"),
          role: "assistant",
          ...FALLBACK_MESSAGE,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage(input);
  }

  const latestAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  return (
    <div className="salon-chatbot">
      {open ? (
        <section
          className="salon-chatbot-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className="salon-chatbot-header">
            <span className="salon-chatbot-brand" aria-hidden="true">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 id={titleId}>SalonAI assistant</h2>
              <p><span /> Online for salon guidance</p>
            </div>
            <button
              type="button"
              className="salon-chatbot-close"
              onClick={() => setOpen(false)}
              aria-label="Close salon assistant"
            >
              <X size={19} />
            </button>
          </header>

          <div
            className="salon-chatbot-messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`salon-chatbot-message is-${message.role}`}
              >
                <span className="salon-chatbot-avatar" aria-hidden="true">
                  {message.role === "assistant" ? (
                    <Bot size={17} />
                  ) : (
                    <UserRound size={17} />
                  )}
                </span>
                <div>
                  <p>{message.text}</p>

                  {message.id === latestAssistantId && message.actions?.length ? (
                    <div className="salon-chatbot-actions">
                      {message.actions.map((action) => (
                        <Link
                          key={`${message.id}-${action.to}`}
                          to={action.to}
                          onClick={() => setOpen(false)}
                        >
                          {action.label}
                          <ArrowRight size={14} />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}

            {sending ? (
              <article className="salon-chatbot-message is-assistant">
                <span className="salon-chatbot-avatar" aria-hidden="true">
                  <Bot size={17} />
                </span>
                <div className="salon-chatbot-typing" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </article>
            ) : null}

            <div ref={endRef} />
          </div>

          {!sending && messages.at(-1)?.role === "assistant" && messages.at(-1)?.quickReplies?.length ? (
            <div className="salon-chatbot-suggestions" aria-label="Suggested questions">
              {messages.at(-1).quickReplies.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submitMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form className="salon-chatbot-form" onSubmit={handleSubmit}>
            <label htmlFor={`${titleId}-input`} className="sr-only">
              Ask the salon assistant
            </label>
            <input
              ref={inputRef}
              id={`${titleId}-input`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={600}
              placeholder="Ask about bookings or haircare…"
              autoComplete="off"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>

          <p className="salon-chatbot-notice">
            General salon guidance only. Don’t share passwords or payment details.
          </p>
        </section>
      ) : null}

      <button
        type="button"
        className={`salon-chatbot-launcher${open ? " is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Close salon assistant" : "Open salon assistant"}
      >
        {open ? <X size={22} /> : <MessageCircle size={23} />}
        {!open ? <span>Ask SalonAI</span> : null}
      </button>
    </div>
  );
}
