import {
  useEffect,
} from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";

import {
  hasConfiguredNonEssentialTracking,
  openTrackingConsentSettings,
  trackingProviders,
} from "../privacy/trackingConsent.js";

import "../styles/legalCompliance.css";

const PROVIDER_PURPOSES = {
  "google-analytics":
    "Analytics: visits, journeys, events and conversion measurement.",
  "google-ads":
    "Advertising and attribution: campaign/conversion measurement and advertising signals.",
  "meta-pixel":
    "Advertising and attribution: Meta campaign measurement and audience-related advertising functions.",
  "microsoft-advertising-uet":
    "Advertising and attribution: Microsoft Advertising conversion measurement through UET.",
  hotjar:
    "Experience analytics: usability and interaction insights used to improve the interface.",
};

export default function CookiePolicyPage() {
  const location =
    useLocation();
  const configured =
    hasConfiguredNonEssentialTracking();

  useEffect(() => {
    if (
      location.hash ===
        "#settings" &&
      configured
    ) {
      openTrackingConsentSettings();
    }
  }, [
    configured,
    location.hash,
  ]);

  return (
    <main className="legal-page">
      <header className="legal-hero">
        <span className="legal-eyebrow">
          Storage, tracking &amp; device access
        </span>
        <h1>Cookie and tracking notice</h1>
        <p>
          This notice explains the storage and access technologies used by
          SalonAI and the measurement providers planned for the first-party
          marketing and analytics module that replaces the previous
          Windsor.ai-style dependency.
        </p>
      </header>

      <section className="legal-card">
        <h2>Consent model</h2>
        <p>
          Necessary storage used for security, authentication and saving your
          privacy choices is available without an optional tracking opt-in.
          Analytics, advertising/attribution and experience-analytics
          technologies are separate optional categories. They default to
          denied and are not loaded by SalonAI until the relevant category is
          granted.
        </p>

        {configured ? (
          <button
            id="settings"
            type="button"
            className="app-button app-button-primary"
            onClick={
              openTrackingConsentSettings
            }
          >
            Change cookie &amp; tracking settings
          </button>
        ) : (
          <p
            id="settings"
            className="legal-note"
          >
            No non-essential browser-tracking provider is currently activated
            in this build. The consent boundary is already implemented so the
            planned providers cannot be enabled later without passing through
            these controls.
          </p>
        )}
      </section>

      <section className="legal-card">
        <h2>Necessary storage</h2>
        <p>
          SalonAI may use session/security cookies and browser storage required
          to provide signed-in functionality, prevent abuse, retain shopping or
          application state requested by the user, and remember privacy choices.
          Necessary storage is not used for behavioural advertising.
        </p>
      </section>

      <section className="legal-card">
        <h2>Optional tracking categories</h2>

        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>
                  Category
                </th>
                <th>
                  Providers
                </th>
                <th>
                  When it runs
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Analytics
                </td>
                <td>
                  Google Analytics
                </td>
                <td>
                  Only after Analytics consent.
                </td>
              </tr>

              <tr>
                <td>
                  Advertising &amp; attribution
                </td>
                <td>
                  Google Ads, Meta Pixel and Microsoft Advertising UET
                </td>
                <td>
                  Only after Advertising &amp; attribution consent.
                </td>
              </tr>

              <tr>
                <td>
                  Experience analytics
                </td>
                <td>
                  Hotjar
                </td>
                <td>
                  Only after Experience analytics consent.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="legal-card">
        <h2>Provider status in this build</h2>
        <ul>
          {trackingProviders.map(
            (provider) => (
              <li
                key={
                  provider.id
                }
              >
                <strong>
                  {provider.name}
                </strong>
                :{" "}
                {provider.configured
                  ? "configured behind the consent boundary"
                  : "planned/not configured in this build"}
                .{" "}
                {
                  PROVIDER_PURPOSES[
                    provider.id
                  ]
                }
              </li>
            )
          )}
        </ul>
      </section>

      <section className="legal-card">
        <h2>Google Consent Mode</h2>
        <p>
          SalonAI uses a conservative basic-consent approach for Google
          measurement: Google Analytics and Google Ads tags are blocked until a
          relevant positive choice exists. When loaded, the application sends
          the corresponding analytics and advertising consent signals.
        </p>
      </section>

      <section className="legal-card">
        <h2>Microsoft Advertising consent</h2>
        <p>
          Microsoft Advertising UET is configured to receive an advertising
          storage consent signal. SalonAI defaults that signal to denied and
          does not activate the UET integration until the advertising category
          is granted.
        </p>
      </section>

      <section className="legal-card">
        <h2>Search Console and Bing Webmaster</h2>
        <p>
          Google Search Console and Bing Webmaster Tools are part of the planned
          first-party search-performance module. Site-verification metadata and
          server/API data connectors are not treated as behavioural browser
          trackers merely because they verify ownership or retrieve search
          performance data. If a future feature introduces browser storage,
          profiling or advertising tracking, it must be assigned to an
          appropriate optional consent category before activation.
        </p>
      </section>

      <section className="legal-card">
        <h2>Changing or withdrawing a choice</h2>
        <p>
          You can reject all optional categories, accept all, or choose
          categories separately. A stored choice expires and must be refreshed
          periodically, and SalonAI can require a fresh choice when the consent
          version or provider purposes materially change.
        </p>

        {configured ? (
          <button
            type="button"
            className="app-button app-button-secondary"
            onClick={
              openTrackingConsentSettings
            }
          >
            Review tracking choices
          </button>
        ) : null}
      </section>

      <section className="legal-card">
        <h2>Related privacy information</h2>
        <p>
          The Privacy Notice explains the wider use of personal data, including
          direct marketing, advertising attribution, retention, recipients,
          international transfers and privacy rights.
        </p>
        <Link to="/privacy">
          Read the Privacy Notice
        </Link>
      </section>
    </main>
  );
}
