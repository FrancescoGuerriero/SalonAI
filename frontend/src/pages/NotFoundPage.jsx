import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main id="main-content" className="not-found-page" tabIndex="-1">
      <section className="not-found-card">
        <span className="not-found-icon" aria-hidden="true">
          <SearchX size={34} />
        </span>

        <p className="not-found-code">Error 404</p>
        <h1>We could not find that page</h1>
        <p>
          The address may be incorrect, or the page may have moved during a
          SalonAI update.
        </p>

        <div className="not-found-actions">
          <Link to="/" className="not-found-primary">
            <Home size={18} />
            Return home
          </Link>

          <button
            type="button"
            className="not-found-secondary"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} />
            Go back
          </button>
        </div>
      </section>
    </main>
  );
}
