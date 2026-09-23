import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import Alert from "../components/ui/Alert.jsx";
import {
  createMyPrivacyRequest,
  downloadMyPrivacyData,
  listMyPrivacyRequests,
} from "../Services/privacyRequestService.js";
import "../styles/legalCompliance.css";

const REQUEST_TYPES = [
  {
    value: "access",
    label: "Access my personal data",
  },
  {
    value: "rectification",
    label: "Correct inaccurate personal data",
  },
  {
    value: "erasure",
    label: "Request erasure",
  },
  {
    value: "restriction",
    label: "Request restriction of processing",
  },
  {
    value: "objection",
    label: "Object to processing",
  },
  {
    value: "portability",
    label: "Request data portability",
  },
];

function formatDate(value) {
  if (!value) return "—";
  const date =
    new Date(value);
  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

export default function PrivacyRightsPage() {
  const [requests, setRequests] =
    useState([]);
  const [requestType, setRequestType] =
    useState("access");
  const [details, setDetails] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [downloading, setDownloading] =
    useState(false);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const payload =
            await listMyPrivacyRequests();
          setRequests(
            payload?.privacyRequests ||
              []
          );
        } catch (requestError) {
          setError(
            requestError?.response?.data
              ?.message ||
              "We could not load your privacy requests."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    load();
  }, [load]);

  async function downloadData() {
    setDownloading(true);
    setError("");
    setMessage("");

    try {
      const result =
        await downloadMyPrivacyData();
      setMessage(
        `Your data export has been prepared as ${result.filename}.`
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
          "We could not export your personal data."
      );
    } finally {
      setDownloading(false);
    }
  }

  async function submitRequest(
    event
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await createMyPrivacyRequest({
        requestType,
        details,
      });
      setDetails("");
      setMessage(
        "Your privacy request has been recorded. SalonAI will review the request and any identity or legal requirements before action is taken."
      );
      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
          "We could not create your privacy request."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="legal-page">
      <header className="legal-hero">
        <span className="legal-eyebrow">
          Your information
        </span>
        <h1>Privacy rights</h1>
        <p>
          Use this authenticated area to make a privacy request about personal
          information associated with your SalonAI account.
        </p>
      </header>

      {error ? (
        <Alert variant="error">
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert variant="success">
          {message}
        </Alert>
      ) : null}

      <section className="legal-card">
        <h2>Download your data</h2>
        <p>
          You can download a structured JSON copy of the main personal data
          associated with your authenticated SalonAI account, including account
          and customer-profile information, appointments, orders, payment
          records, consent evidence, communication delivery history and privacy
          requests. Provider secrets and staff-only internal notes are excluded.
        </p>
        <button
          type="button"
          className="app-button app-button-secondary"
          disabled={downloading}
          onClick={downloadData}
        >
          {downloading
            ? "Preparing export…"
            : "Download my SalonAI data"}
        </button>
      </section>

      <section className="legal-card">
        <h2>Make a request</h2>
        <p>
          Rights depend on the applicable law and the lawful basis for the
          processing. A request is not automatically destructive: SalonAI must
          verify identity and consider any legal, contractual, security or
          record-retention obligations before completing it.
        </p>

        <form
          className="privacy-request-form"
          onSubmit={
            submitRequest
          }
        >
          <label
            htmlFor="privacyRequestType"
          >
            Request type
          </label>

          <select
            id="privacyRequestType"
            value={requestType}
            onChange={(event) =>
              setRequestType(
                event.target.value
              )
            }
          >
            {REQUEST_TYPES.map(
              ({
                value,
                label,
              }) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>

          <label
            htmlFor="privacyRequestDetails"
          >
            Details
          </label>

          <textarea
            id="privacyRequestDetails"
            rows={6}
            maxLength={4000}
            value={details}
            onChange={(event) =>
              setDetails(
                event.target.value
              )
            }
            placeholder="Explain what information or processing your request relates to."
          />

          <button
            type="submit"
            className="app-button app-button-primary"
            disabled={saving}
          >
            {saving
              ? "Submitting…"
              : "Submit privacy request"}
          </button>
        </form>
      </section>

      <section className="legal-card">
        <h2>Your requests</h2>

        {loading ? (
          <p>
            Loading privacy requests…
          </p>
        ) : requests.length === 0 ? (
          <p>
            You have not submitted a privacy request through this account.
          </p>
        ) : (
          <div className="privacy-request-list">
            {requests.map(
              (request) => (
                <article
                  className="privacy-request-item"
                  key={
                    request.id
                  }
                >
                  <div>
                    <strong>
                      {
                        REQUEST_TYPES.find(
                          (item) =>
                            item.value ===
                            request.requestType
                        )?.label ||
                        request.requestType
                      }
                    </strong>
                    <span>
                      Status:{" "}
                      {
                        request.status
                      }
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>
                        Received
                      </dt>
                      <dd>
                        {formatDate(
                          request.receivedAt
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Target response
                      </dt>
                      <dd>
                        {formatDate(
                          request.targetResponseAt
                        )}
                      </dd>
                    </div>
                  </dl>

                  {request.responseSummary ? (
                    <p>
                      {
                        request.responseSummary
                      }
                    </p>
                  ) : null}
                </article>
              )
            )}
          </div>
        )}
      </section>

      <section className="legal-card">
        <h2>Direct marketing objection</h2>
        <p>
          Marketing can be turned off immediately through Communication
          Settings or the unsubscribe link in a marketing message. You do not
          need to submit a privacy-rights request merely to stop marketing.
        </p>
        <Link
          to="/settings"
          className="app-button app-button-secondary"
        >
          Communication settings
        </Link>
      </section>

      <section className="legal-card">
        <h2>Privacy information</h2>
        <p>
          Read the public Privacy Notice for information about purposes,
          retention, recipients, international transfers and complaint rights.
        </p>
        <Link to="/privacy">
          Read the Privacy Notice
        </Link>
      </section>
    </main>
  );
}
