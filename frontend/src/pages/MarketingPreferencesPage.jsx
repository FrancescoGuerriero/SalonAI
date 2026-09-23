import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import Alert from "../components/ui/Alert.jsx";
import {
  getPublicMarketingPreferences,
  unsubscribePublicMarketing,
} from "../Services/publicMarketingPreferencesService.js";
import "../styles/legalCompliance.css";

function unwrap(response) {
  return response?.data ?? response ?? {};
}

const CHANNELS = [
  {
    key: "email",
    label: "Email marketing",
  },
  {
    key: "sms",
    label: "SMS marketing",
  },
  {
    key: "whatsapp",
    label: "WhatsApp marketing",
  },
];

export default function MarketingPreferencesPage() {
  const { token = "" } =
    useParams();
  const [preferences, setPreferences] =
    useState(null);
  const [legal, setLegal] =
    useState(null);
  const [loading, setLoading] =
    useState(Boolean(token));
  const [working, setWorking] =
    useState("");
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    if (!token) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    getPublicMarketingPreferences(token)
      .then((response) => {
        if (!active) return;
        const payload =
          unwrap(response);
        setPreferences(
          payload.marketingPreferences ||
            {}
        );
        setLegal(
          payload.legal || {}
        );
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError?.response?.data
            ?.message ||
            "This marketing preference link is invalid or no longer available."
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const enabledCount =
    useMemo(
      () =>
        CHANNELS.filter(
          ({ key }) =>
            preferences?.[key] ===
            true
        ).length,
      [preferences]
    );

  async function optOut(channel) {
    if (!token || working) return;

    setWorking(channel);
    setError("");
    setMessage("");

    try {
      const response =
        await unsubscribePublicMarketing(
          token,
          channel
        );
      const payload =
        unwrap(response);
      setPreferences(
        payload.marketingPreferences ||
          {}
      );
      setMessage(
        payload.message ||
          "Your marketing preference has been updated."
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data
          ?.message ||
          "We could not update your marketing preference."
      );
    } finally {
      setWorking("");
    }
  }

  return (
    <main className="legal-page">
      <header className="legal-hero">
        <span className="legal-eyebrow">
          Communication control
        </span>
        <h1>Marketing preferences</h1>
        <p>
          Marketing choices are separate from essential booking, payment,
          security and service communications.
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

      {!token ? (
        <section className="legal-card">
          <h2>Manage your choices</h2>
          <p>
            Use the personalised preference link in a SalonAI marketing message
            to unsubscribe without signing in. To opt in or change broader
            account communication settings, sign in to your customer account.
          </p>
          <Link
            to="/login"
            className="app-button app-button-primary"
          >
            Sign in
          </Link>
        </section>
      ) : loading ? (
        <section className="legal-card">
          <p>Loading your marketing preferences…</p>
        </section>
      ) : preferences ? (
        <>
          <section className="legal-card">
            <h2>Current marketing channels</h2>
            <p>
              {enabledCount === 0
                ? "No marketing channels are currently enabled."
                : `${enabledCount} marketing channel${enabledCount === 1 ? "" : "s"} currently enabled.`}
            </p>

            <div className="marketing-preference-list">
              {CHANNELS.map(
                ({ key, label }) => {
                  const enabled =
                    preferences[key] ===
                    true;

                  return (
                    <div
                      className="marketing-preference-row"
                      key={key}
                    >
                      <div>
                        <strong>{label}</strong>
                        <span>
                          {enabled
                            ? "Enabled"
                            : "Off"}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="app-button app-button-secondary"
                        disabled={
                          !enabled ||
                          Boolean(working)
                        }
                        onClick={() =>
                          optOut(key)
                        }
                      >
                        {working === key
                          ? "Updating…"
                          : enabled
                            ? "Turn off"
                            : "Off"}
                      </button>
                    </div>
                  );
                }
              )}
            </div>

            <button
              type="button"
              className="app-button app-button-secondary"
              disabled={
                enabledCount === 0 ||
                Boolean(working)
              }
              onClick={() =>
                optOut("all")
              }
            >
              {working === "all"
                ? "Updating…"
                : "Turn off all marketing"}
            </button>
          </section>

          <section className="legal-card">
            <h2>Want to opt back in?</h2>
            <p>
              For consent integrity, a public unsubscribe link can only withdraw
              marketing permission. Sign in to actively opt back in to specific
              channels.
            </p>
            <Link
              to="/settings"
              className="app-button app-button-primary"
            >
              Open communication settings
            </Link>
          </section>
        </>
      ) : null}

      <section className="legal-card">
        <h2>Privacy</h2>
        <p>
          {legal?.businessName
            ? `${legal.businessName} records marketing choices so they can be respected.`
            : "SalonAI records marketing choices so they can be respected."}
        </p>
        <Link to="/privacy">
          Read the Privacy Notice
        </Link>
      </section>
    </main>
  );
}
