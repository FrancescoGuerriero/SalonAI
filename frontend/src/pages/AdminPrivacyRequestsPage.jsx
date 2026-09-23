import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Alert from "../components/ui/Alert.jsx";
import {
  listPrivacyRequests,
  updatePrivacyRequest,
} from "../Services/privacyRequestService.js";
import "../styles/legalCompliance.css";

const STATUSES = [
  "received",
  "identity_verification",
  "in_review",
  "action_required",
  "completed",
  "refused",
  "withdrawn",
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
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

export default function AdminPrivacyRequestsPage() {
  const [requests, setRequests] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState("");
  const [error, setError] =
    useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const payload =
            await listPrivacyRequests();
          setRequests(
            payload?.privacyRequests ||
              []
          );
        } catch (requestError) {
          setError(
            requestError?.response?.data
              ?.message ||
              "Unable to load privacy requests."
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

  async function changeStatus(
    request,
    status
  ) {
    setSaving(
      request._id
    );
    setError("");

    try {
      await updatePrivacyRequest(
        request._id,
        {
          status,
        }
      );
      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
          "Unable to update the privacy request."
      );
    } finally {
      setSaving("");
    }
  }

  return (
    <main className="legal-page">
      <header className="legal-hero">
        <span className="legal-eyebrow">
          Administrator privacy operations
        </span>
        <h1>Privacy requests</h1>
        <p>
          Track customer data-rights requests, identity verification and
          completion status. This view is restricted to administrators.
        </p>
      </header>

      {error ? (
        <Alert variant="error">
          {error}
        </Alert>
      ) : null}

      <section className="legal-card">
        <h2>Open and recent requests</h2>

        {loading ? (
          <p>
            Loading privacy requests…
          </p>
        ) : requests.length === 0 ? (
          <p>
            No privacy requests have been recorded.
          </p>
        ) : (
          <div className="privacy-admin-table-wrap">
            <table className="privacy-admin-table">
              <thead>
                <tr>
                  <th>
                    Customer
                  </th>
                  <th>
                    Request
                  </th>
                  <th>
                    Received
                  </th>
                  <th>
                    Target
                  </th>
                  <th>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map(
                  (request) => (
                    <tr
                      key={
                        request._id
                      }
                    >
                      <td>
                        <strong>
                          {
                            request
                              .requester
                              ?.name ||
                            request
                              .customerProfile
                              ?.firstName ||
                            "Customer"
                          }
                        </strong>
                        <span>
                          {
                            request
                              .requester
                              ?.email ||
                            request
                              .customerProfile
                              ?.email ||
                            ""
                          }
                        </span>
                      </td>
                      <td>
                        {
                          request.requestType
                        }
                      </td>
                      <td>
                        {formatDate(
                          request.receivedAt
                        )}
                      </td>
                      <td>
                        {formatDate(
                          request.targetResponseAt
                        )}
                      </td>
                      <td>
                        <select
                          aria-label="Privacy request status"
                          value={
                            request.status
                          }
                          disabled={
                            saving ===
                            request._id
                          }
                          onChange={(
                            event
                          ) =>
                            changeStatus(
                              request,
                              event.target.value
                            )
                          }
                        >
                          {STATUSES.map(
                            (
                              status
                            ) => (
                              <option
                                key={
                                  status
                                }
                                value={
                                  status
                                }
                              >
                                {
                                  status
                                }
                              </option>
                            )
                          )}
                        </select>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
