export default function NotificationSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}) {
  return (
    <article className="notification-summary-card">
      <span className="notification-summary-icon" aria-hidden="true">
        {Icon ? <Icon size={20} /> : null}
      </span>

      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}
