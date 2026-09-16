import { Component, Fragment } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      recoveryAttempt: 0,
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
    this.setState((state) => ({
      hasError: false,
      error: null,
      recoveryAttempt: state.recoveryAttempt + 1,
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return (
        <Fragment key={this.state.recoveryAttempt}>
          {this.props.children}
        </Fragment>
      );
    }

    return (
      <main className="app-error-page" id="main-content">
        <section
          className="app-error-card"
          role="alert"
          aria-live="assertive"
          aria-labelledby="app-error-title"
          aria-describedby="app-error-description"
        >
          <span className="app-error-icon" aria-hidden="true">
            <AlertTriangle size={34} />
          </span>

          <p className="app-error-eyebrow">Application recovery</p>
          <h1 id="app-error-title">Something went wrong</h1>
          <p id="app-error-description">
            This screen encountered an unexpected error. Try the page again,
            reload SalonAI, or return to the home page.
          </p>

          {import.meta.env.DEV && this.state.error?.message ? (
            <pre className="app-error-details" aria-label="Development error details">
              {this.state.error.message}
            </pre>
          ) : null}

          <div className="app-error-actions">
            <button
              type="button"
              className="app-error-primary"
              onClick={this.handleRetry}
            >
              <RefreshCw size={18} aria-hidden="true" />
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
              <Home size={18} aria-hidden="true" />
              Return home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
