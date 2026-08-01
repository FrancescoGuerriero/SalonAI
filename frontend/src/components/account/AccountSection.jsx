export default function AccountSection({
  title,
  description,
  action,
  children,
}) {
  return (
    <section className="account-section">
      <header className="account-section-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
