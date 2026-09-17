import React, { Fragment } from "react";

export default class ErrorBoundary extends React.Component {
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

  componentDidCatch(error, info) {
    console.error("Frontend error boundary", {
      error,
      componentStack: info.componentStack,
    });
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
    if (this.state.hasError) {
      return (
        <main
          className="min-h-screen bg-slate-50 px-4 py-16"
          id="main-content"
        >
          <section
            className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 shadow-sm"
            role="alert"
            aria-live="assertive"
            aria-labelledby="legacy-error-title"
            aria-describedby="legacy-error-description"
          >
            <p
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-700"
            >
              Application recovery
            </p>

            <h1
              id="legacy-error-title"
              className="text-2xl font-bold text-slate-900"
            >
              Something went wrong
            </h1>

            <p
              id="legacy-error-description"
              className="mt-3 text-slate-600"
            >
              The page could not be displayed correctly. You can try
              rendering it again or reload SalonAI.
            </p>

            {import.meta.env.DEV && this.state.error?.message ? (
              <pre
                className="mt-5 max-h-40 overflow-auto rounded-xl bg-slate-900 p-4 text-left text-sm text-slate-100"
                aria-label="Development error details"
              >
                {this.state.error.message}
              </pre>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
              >
                Try again
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
              >
                Reload application
              </button>

              <a
                href="/"
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
              >
                Return home
              </a>
            </div>
          </section>
        </main>
      );
    }

    return (
      <Fragment key={this.state.recoveryAttempt}>
        {this.props.children}
      </Fragment>
    );
  }
}
