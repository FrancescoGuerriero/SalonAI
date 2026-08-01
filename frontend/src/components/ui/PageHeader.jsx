export default function PageHeader({ eyebrow, title, description, actions, children }) {
  return <section className="app-page-header"><div><div>{eyebrow && <p className="app-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="app-page-description">{description}</p>}</div>{actions && <div className="app-page-actions">{actions}</div>}</div>{children}</section>;
}
