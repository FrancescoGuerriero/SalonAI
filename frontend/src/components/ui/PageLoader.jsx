export default function PageLoader({
  message = "Loading SalonAI…",
  compact = false,
}) {
  const className = compact
    ? "page-loader page-loader-compact"
    : "page-loader";

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <span
        className="page-loader-spinner"
        aria-hidden="true"
      />

      <p>{message}</p>
    </div>
  );
}
