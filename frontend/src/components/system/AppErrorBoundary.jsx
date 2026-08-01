import { Component } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SalonAI frontend error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-error-page" id="main-content">
        <section className="app-error-card" role="alert">
          <span className="app-error-icon" aria-hidden="true">
            <AlertTriangle size={34} />
          </span>

          <p className="app-error-eyebrow">Application recovery</p>
          <h1>Something went wrong</h1>
          <p>
            SalonAI encountered an unexpected frontend error. Your account and
            saved data have not been deleted.
          </p>

          {import.meta.env.DEV && this.state.error?.message ? (
            <pre className="app-error-details">
              {this.state.error.message}
            </pre>
          ) : null}

          <div className="app-error-actions">
            <button
              type="button"
              className="app-error-primary"
              onClick={this.handleRetry}
            >
              <RefreshCw size={18} />
              Try again
            </button>

            <button
              type="button"
              className="app-error-secondary"
              onClick={this.handleReload}
            >
              Reload application
            </button>

            <a className="app-error-secondary" href="/">
              <Home size={18} />
              Return home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
