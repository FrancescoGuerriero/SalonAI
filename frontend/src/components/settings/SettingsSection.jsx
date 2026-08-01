export default function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}) {
  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <span aria-hidden="true">
          {Icon ? <Icon size={20} /> : null}
        </span>

        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="settings-section-body">{children}</div>
    </section>
  );
}
