import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  TRACKING_CATEGORIES,
  TRACKING_CONSENT_OPEN_EVENT,
  TRACKING_CONSENT_UPDATED_EVENT,
  acceptAllTracking,
  configuredTrackingProviders,
  hasConfiguredNonEssentialTracking,
  readTrackingConsent,
  rejectNonEssentialTracking,
  writeTrackingConsent,
} from "../../privacy/trackingConsent.js";

import {
  applyTrackingIntegrations,
  initialiseTrackingConsentBoundary,
} from "../../privacy/trackingIntegrations.js";

import "../../styles/trackingConsent.css";

const EMPTY_CHOICES = {
  analytics: false,
  advertising: false,
  experience: false,
};

function recordChoices(
  record
) {
  return {
    ...EMPTY_CHOICES,
    ...(record?.choices ||
      {}),
  };
}

export default function TrackingConsentBanner() {
  const [record, setRecord] =
    useState(() =>
      readTrackingConsent()
    );
  const [open, setOpen] =
    useState(() =>
      hasConfiguredNonEssentialTracking() &&
      !readTrackingConsent()
    );
  const [customising, setCustomising] =
    useState(false);
  const [choices, setChoices] =
    useState(() =>
      recordChoices(
        readTrackingConsent()
      )
    );

  const providers =
    useMemo(
      () =>
        configuredTrackingProviders(),
      []
    );

  useEffect(() => {
    initialiseTrackingConsentBoundary();

    if (record) {
      applyTrackingIntegrations(
        record
      );
    }
  }, []);

  useEffect(() => {
    function onUpdated(
      event
    ) {
      const next =
        event.detail ||
        readTrackingConsent();

      setRecord(next);
      setChoices(
        recordChoices(
          next
        )
      );

      applyTrackingIntegrations(
        next
      );
    }

    function onOpen() {
      const current =
        readTrackingConsent();

      setChoices(
        recordChoices(
          current
        )
      );
      setCustomising(true);
      setOpen(true);
    }

    window.addEventListener(
      TRACKING_CONSENT_UPDATED_EVENT,
      onUpdated
    );
    window.addEventListener(
      TRACKING_CONSENT_OPEN_EVENT,
      onOpen
    );

    return () => {
      window.removeEventListener(
        TRACKING_CONSENT_UPDATED_EVENT,
        onUpdated
      );
      window.removeEventListener(
        TRACKING_CONSENT_OPEN_EVENT,
        onOpen
      );
    };
  }, []);

  if (
    !hasConfiguredNonEssentialTracking() ||
    !open
  ) {
    return null;
  }

  function acceptAll() {
    acceptAllTracking();
    setOpen(false);
    setCustomising(false);
  }

  function rejectAll() {
    rejectNonEssentialTracking();
    setOpen(false);
    setCustomising(false);
  }

  function saveCustom() {
    const previous =
      recordChoices(
        record
      );
    const next =
      writeTrackingConsent(
        choices,
        {
          source:
            record
              ? "cookie_settings"
              : "consent_banner",
        }
      );

    const revoked =
      (
        previous.experience &&
        !next.choices
          .experience
      ) ||
      (
        previous.advertising &&
        !next.choices
          .advertising
      );

    setOpen(false);
    setCustomising(false);

    if (
      revoked &&
      typeof window !==
        "undefined"
    ) {
      window.location.reload();
    }
  }

  return (
    <div
      className="tracking-consent-overlay"
      role="presentation"
    >
      <section
        className="tracking-consent-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-consent-title"
        aria-describedby="tracking-consent-description"
      >
        <span className="legal-eyebrow">
          Privacy choices
        </span>

        <h2 id="tracking-consent-title">
          Choose how SalonAI measures and improves the service
        </h2>

        <p
          id="tracking-consent-description"
          className="tracking-consent-intro"
        >
          Necessary storage used for security, sign-in and choices is always on.
          Optional measurement and advertising technologies stay off unless you
          choose them. You can change your choice later.
        </p>

        {customising ? (
          <div className="tracking-consent-options">
            {Object.values(
              TRACKING_CATEGORIES
            ).map(
              (category) => {
                const categoryProviders =
                  providers.filter(
                    (provider) =>
                      provider.category ===
                      category.id
                  );

                return (
                  <label
                    key={
                      category.id
                    }
                    className="tracking-consent-option"
                  >
                    <input
                      type="checkbox"
                      checked={
                        choices[
                          category.id
                        ]
                      }
                      onChange={(
                        event
                      ) =>
                        setChoices(
                          (
                            current
                          ) => ({
                            ...current,
                            [category.id]:
                              event
                                .target
                                .checked,
                          })
                        )
                      }
                    />

                    <span>
                      <strong>
                        {
                          category.label
                        }
                      </strong>
                      <small>
                        {
                          category.description
                        }
                      </small>

                      {categoryProviders.length ? (
                        <small className="tracking-consent-providers">
                          Configured providers:{" "}
                          {categoryProviders
                            .map(
                              (
                                provider
                              ) =>
                                provider.name
                            )
                            .join(", ")}
                        </small>
                      ) : null}
                    </span>
                  </label>
                );
              }
            )}
          </div>
        ) : null}

        <div className="tracking-consent-links">
          <Link to="/cookies">
            Cookie &amp; storage notice
          </Link>
          <Link to="/privacy">
            Privacy Notice
          </Link>
        </div>

        <div className="tracking-consent-actions">
          <button
            type="button"
            className="app-button app-button-secondary"
            onClick={
              rejectAll
            }
          >
            Reject non-essential
          </button>

          <button
            type="button"
            className="app-button app-button-secondary"
            onClick={() =>
              setCustomising(
                (
                  value
                ) =>
                  !value
              )
            }
          >
            {customising
              ? "Hide choices"
              : "Customise"}
          </button>

          {customising ? (
            <button
              type="button"
              className="app-button app-button-primary"
              onClick={
                saveCustom
              }
            >
              Save choices
            </button>
          ) : (
            <button
              type="button"
              className="app-button app-button-primary"
              onClick={
                acceptAll
              }
            >
              Accept all
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
