export default function PageLoader({
  label = "Loading SalonAI…",
  compact = false,
}) {
  return (
    <div
      className={`page-loader ${compact ? "page-loader-compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="page-loader-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
