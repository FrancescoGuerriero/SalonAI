import {
  Link,
} from "react-router-dom";

import "../styles/legalCompliance.css";

export default function CookiePolicyPage() {
  return (
    <main className="legal-page">
      <header className="legal-hero">
        <span className="legal-eyebrow">
          Storage & device access
        </span>
        <h1>Cookie and storage notice</h1>
        <p>
          This notice explains the cookies and browser storage used by the
          current SalonAI application.
        </p>
      </header>

      <section className="legal-card">
        <h2>Current baseline</h2>
        <p>
          SalonAI currently treats authentication/session security and storage
          that a user explicitly requests for application preferences as
          necessary service functionality. Non-essential advertising and
          analytics tracking is not enabled by the Stage 3.0 compliance
          baseline.
        </p>
      </section>

      <section className="legal-card">
        <h2>Strictly necessary technologies</h2>
        <p>
          The application may use security/session cookies required for signed-in
          account operation and secure session renewal. These are used to provide
          the service requested by the user and are not used for advertising.
        </p>
      </section>

      <section className="legal-card">
        <h2>Local application preferences</h2>
        <p>
          SalonAI may use browser storage for user-requested display choices,
          such as interface preferences. These settings remain on the device
          unless the user or browser clears them.
        </p>
      </section>

      <section className="legal-card">
        <h2>Analytics and advertising</h2>
        <p>
          Non-essential analytics, advertising pixels and similar tracking
          technologies are not authorised merely by visiting SalonAI. If such
          technologies are introduced later, they must remain disabled until the
          applicable notice and consent controls are implemented and accepted in
          production.
        </p>
      </section>

      <section className="legal-card">
        <h2>Related privacy information</h2>
        <p>
          For information about personal data, direct marketing, retention,
          recipients and your rights, read the Privacy Notice.
        </p>
        <Link to="/privacy">
          Read the Privacy Notice
        </Link>
      </section>
    </main>
  );
}
