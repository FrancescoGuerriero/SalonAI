export default function AccountSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}) {
  return (
    <article className="account-summary-card">
      <span className="account-summary-icon" aria-hidden="true">
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
