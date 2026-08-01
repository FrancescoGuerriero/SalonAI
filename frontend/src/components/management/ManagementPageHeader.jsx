import { Link } from "react-router-dom";

export default function ManagementPageHeader({ eyebrow = "SalonAI management", title, description, actions = [], meta = [] }) {
  return (
    <header className="management-page-header">
      <div className="management-page-header-copy">
        <span className="management-page-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {meta.length ? <div className="management-page-meta">{meta.map((item) => <span key={item}>{item}</span>)}</div> : null}
      </div>
      {actions.length ? <div className="management-page-actions">{actions.map(({ label, to, icon: Icon, variant = "secondary", onClick }) => to ? <Link key={label} to={to} className={`app-button app-button-${variant}`}>{Icon ? <Icon size={17} /> : null}{label}</Link> : <button key={label} type="button" onClick={onClick} className={`app-button app-button-${variant}`}>{Icon ? <Icon size={17} /> : null}{label}</button>)}</div> : null}
    </header>
  );
}
