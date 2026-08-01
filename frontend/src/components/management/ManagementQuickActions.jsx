import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function ManagementQuickActions({ title = "Quick actions", description, actions = [] }) {
  return (
    <section className="management-quick-actions" aria-labelledby="management-quick-actions-title">
      <div className="management-section-heading">
        <div><span className="management-page-eyebrow">Workflow shortcuts</span><h2 id="management-quick-actions-title">{title}</h2>{description ? <p>{description}</p> : null}</div>
      </div>
      <div className="management-quick-action-grid">
        {actions.map(({ to, label, description: detail, icon: Icon, badge }) => (
          <Link className="management-quick-action" to={to} key={to}>
            <span className="management-quick-action-icon">{Icon ? <Icon size={20} /> : null}</span>
            <span className="management-quick-action-copy"><strong>{label}</strong><small>{detail}</small>{badge ? <em>{badge}</em> : null}</span>
            <ArrowUpRight size={18} className="management-quick-action-arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}
