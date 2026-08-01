import { ChevronDown } from "lucide-react";

export default function FaqAccordion({ item, isOpen, onToggle }) {
  const panelId = `faq-panel-${item.id}`;
  const buttonId = `faq-button-${item.id}`;

  return (
    <article className={`faq-item ${isOpen ? "is-open" : ""}`}>
      <button
        id={buttonId}
        type="button"
        className="faq-question"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span>{item.question}</span>
        <ChevronDown size={19} aria-hidden="true" />
      </button>
      <div
        id={panelId}
        className="faq-answer"
        role="region"
        aria-labelledby={buttonId}
        hidden={!isOpen}
      >
        <p>{item.answer}</p>
      </div>
    </article>
  );
}
