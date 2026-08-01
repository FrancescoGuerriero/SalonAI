import { AlertTriangle, RefreshCw } from "lucide-react";
import PageLoader from "./PageLoader.jsx";

export default function AsyncState({
  loading,
  error,
  empty,
  emptyTitle = "Nothing to display",
  emptyMessage = "There is currently no information available.",
  onRetry,
  loadingLabel,
  children,
}) {
  if (loading) {
    return <PageLoader label={loadingLabel} />;
  }

  if (error) {
    return (
      <section className="async-state async-state-error" role="alert">
        <AlertTriangle size={28} />
        <h2>We could not load this content</h2>
        <p>{error}</p>

        {onRetry ? (
          <button type="button" onClick={onRetry}>
            <RefreshCw size={17} />
            Try again
          </button>
        ) : null}
      </section>
    );
  }

  if (empty) {
    return (
      <section className="async-state async-state-empty">
        <h2>{emptyTitle}</h2>
        <p>{emptyMessage}</p>
      </section>
    );
  }

  return children;
}
