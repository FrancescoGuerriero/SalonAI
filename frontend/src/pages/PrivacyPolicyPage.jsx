import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import {
  getPublicLegalIdentity,
} from "../Services/publicLegalService.js";
import "../styles/legalCompliance.css";

function unwrap(response) {
  return response?.data ?? response ?? {};
}

export default function PrivacyPolicyPage() {
  const [legal, setLegal] =
    useState(null);
  const [configured, setConfigured] =
    useState(false);

  useEffect(() => {
    let active = true;

    getPublicLegalIdentity()
      .then((response) => {
        if (!active) return;
        const payload =
          unwrap(response);
        setLegal(
          payload.legal || {}
        );
        setConfigured(
          payload.marketingComplianceConfigured ===
            true
        );
      })
      .catch(() => {
        if (!active) return;
        setLegal({
          tradingName:
            "SalonAI",
          businessName:
            "SalonAI",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const name =
    legal?.tradingName ||
    legal?.businessName ||
    "SalonAI";

  return (
    <main className="legal-page">
      <header className="legal-hero">
        <span className="legal-eyebrow">
          Privacy & data protection
        </span>
        <h1>Privacy notice</h1>
        <p>
          This notice explains how {name} uses personal information, including
          account, booking, payment, service and communication data.
        </p>
      </header>

      {!configured ? (
        <div
          className="legal-warning"
          role="status"
        >
          Marketing remains disabled until the business legal identity, postal
          address and privacy contact are fully configured.
        </div>
      ) : null}

      <section className="legal-card">
        <h2>Who is responsible for your data?</h2>
        <p>
          Data controller: <strong>{legal?.businessName || name}</strong>
          {legal?.companyNumber ? ` (company number ${legal.companyNumber})` : ""}.
        </p>
        {legal?.postalAddress ? (
          <p>Postal address: {legal.postalAddress}</p>
        ) : null}
        {legal?.privacyEmail ? (
          <p>
            Privacy contact:{" "}
            <a href={`mailto:${legal.privacyEmail}`}>
              {legal.privacyEmail}
            </a>
          </p>
        ) : null}
      </section>

      <section className="legal-card">
        <h2>Information we use</h2>
        <p>
          Depending on how you use SalonAI, this may include account and contact
          details, appointment and service history, communication preferences,
          purchase and payment references, customer-service records, and
          information you choose to provide in consultation or profile features.
        </p>
      </section>

      <section className="legal-card">
        <h2>Why we use information</h2>
        <ul>
          <li>to provide accounts, bookings, services, payments and support;</li>
          <li>to send necessary transactional and service communications;</li>
          <li>to meet security, fraud-prevention, accounting and legal obligations;</li>
          <li>to improve and operate the service where a lawful basis applies; and</li>
          <li>
            to send optional direct marketing only where the required marketing
            permission exists.
          </li>
        </ul>
      </section>

      <section className="legal-card">
        <h2>Marketing communications</h2>
        <p>
          Marketing is separate from booking, payment and other service messages.
          Marketing choices are off by default and are recorded separately for
          email, SMS and WhatsApp. You can withdraw a marketing permission at
          any time.
        </p>
        <p>
          Every marketing email contains a preference/unsubscribe link. A public
          unsubscribe link can turn marketing off without requiring sign-in.
          Re-enabling marketing requires an authenticated customer action so
          another person cannot grant consent on your behalf.
        </p>
        <p>
          Signed-in customers can manage channel choices from{" "}
          <Link to="/settings">Communication settings</Link>.
        </p>
      </section>

      <section className="legal-card">
        <h2>Service providers and international transfers</h2>
        <p>
          We use specialist service providers to operate SalonAI, including
          communications, cloud/database, payment and hosting providers. Current
          integrations include Twilio/SendGrid for enabled communications and
          Stripe for supported online payments. Where personal data is
          transferred internationally, the business must use the safeguards
          required by applicable data-protection law and provider contracts.
        </p>
      </section>

      <section className="legal-card">
        <h2>Your rights</h2>
        <p>
          Depending on the law that applies to you, rights may include access,
          correction, deletion, restriction, portability, withdrawal of consent
          and objection. You have an unconditional right to object to processing
          for direct marketing where UK GDPR applies.
        </p>
        <p>
          You can contact the privacy address above. UK users may also complain
          to the Information Commissioner’s Office.
        </p>
      </section>

      <section className="legal-card">
        <h2>Retention and security</h2>
        <p>
          Personal information should be retained only for documented business,
          contractual, legal, security and dispute-resolution needs. Marketing
          opt-outs may be retained as suppression evidence so an unsubscribe is
          not accidentally reversed. SalonAI uses authenticated access,
          role-based permissions, transport security and audit controls for
          protected application functions.
        </p>
      </section>

      <section className="legal-card">
        <h2>Version</h2>
        <p>
          Privacy notice version: {legal?.privacyPolicyVersion || "2026-09"}.
          Material changes should be reflected here and in the consent evidence
          collected after the change.
        </p>
      </section>
    </main>
  );
}
