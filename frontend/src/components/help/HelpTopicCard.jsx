import { ChevronRight } from "lucide-react";

export default function HelpTopicCard({ icon: Icon, title, description, onSelect }) {
  return (
    <button type="button" className="help-topic-card" onClick={onSelect}>
      <span className="help-topic-icon" aria-hidden="true">
        {Icon ? <Icon size={21} /> : null}
      </span>
      <span className="help-topic-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
