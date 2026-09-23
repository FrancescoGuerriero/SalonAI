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
          payload
            .marketingComplianceConfigured ===
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
          Privacy &amp; data protection
        </span>
        <h1>Privacy Notice</h1>
        <p>
          This notice explains how {name} processes personal information when
          people use the SalonAI website, customer account, booking, commerce,
          communications and supported salon-service features.
        </p>
      </header>

      {!configured ? (
        <div
          className="legal-warning"
          role="status"
        >
          The public legal identity is not yet fully configured. Optional
          marketing remains fail-closed until the controller identity, public
          postal address, privacy contact and preference controls pass
          production acceptance.
        </div>
      ) : null}

      <nav
        className="legal-quick-links"
        aria-label="Privacy notice sections"
      >
        <a href="#controller">
          Controller
        </a>
        <a href="#data">
          Data we use
        </a>
        <a href="#purposes">
          Purposes &amp; lawful bases
        </a>
        <a href="#sharing">
          Sharing
        </a>
        <a href="#retention">
          Retention
        </a>
        <a href="#rights">
          Your rights
        </a>
      </nav>

      <section
        className="legal-card"
        id="controller"
      >
        <h2>1. Who is responsible for your data?</h2>
        <dl className="legal-definition-list">
          <div>
            <dt>Controller / operator</dt>
            <dd>
              <strong>
                {legal?.businessName || name}
              </strong>
              {legal?.tradingName &&
              legal.tradingName !==
                legal.businessName
                ? ` trading as ${legal.tradingName}`
                : ""}
            </dd>
          </div>

          {legal?.companyNumber ? (
            <div>
              <dt>
                Company number
              </dt>
              <dd>
                {legal.companyNumber}
              </dd>
            </div>
          ) : null}

          <div>
            <dt>
              Registered jurisdiction
            </dt>
            <dd>
              {legal?.registeredJurisdiction ||
                "To be confirmed before live marketing activation"}
            </dd>
          </div>

          {legal?.postalAddress ? (
            <div>
              <dt>
                Postal address
              </dt>
              <dd>
                {legal.postalAddress}
              </dd>
            </div>
          ) : null}

          {legal?.privacyEmail ? (
            <div>
              <dt>
                Privacy contact
              </dt>
              <dd>
                <a
                  href={`mailto:${legal.privacyEmail}`}
                >
                  {legal.privacyEmail}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        className="legal-card"
        id="data"
      >
        <h2>2. Personal information we may process</h2>
        <div className="legal-grid">
          <article>
            <h3>
              Account &amp; identity
            </h3>
            <p>
              Name, email address, telephone number, authentication identifiers,
              connected sign-in providers, account role, security/session data
              and account preferences.
            </p>
          </article>

          <article>
            <h3>
              Booking &amp; service
            </h3>
            <p>
              Appointments, selected services, stylist preferences, booking
              history, attendance, service packages and information a customer
              chooses to provide for consultation or service delivery.
            </p>
          </article>

          <article>
            <h3>
              Commerce &amp; payments
            </h3>
            <p>
              Orders, products, payment status, transaction references,
              deposits, refunds and fulfilment information. Payment-card data
              handled by the payment provider is not intended to be stored as
              raw card data by SalonAI.
            </p>
          </article>

          <article>
            <h3>
              Communications
            </h3>
            <p>
              Communication preferences, consent/withdrawal evidence, message
              delivery status, campaign participation, support interactions and
              provider delivery events.
            </p>
          </article>

          <article>
            <h3>
              Technical &amp; security
            </h3>
            <p>
              Request identifiers, IP/security logs, device/browser information,
              audit events, error information and other data needed to protect
              accounts and operate the service.
            </p>
          </article>

          <article>
            <h3>
              AI-assisted features
            </h3>
            <p>
              Where an enabled SalonAI feature uses AI, relevant application
              data may be processed to provide recommendations, summaries or
              operational assistance. AI features must remain subject to access
              controls, auditability and the human-review requirements defined
              for the feature.
            </p>
          </article>
        </div>
      </section>

      <section
        className="legal-card"
        id="purposes"
      >
        <h2>3. Why we use information and the intended lawful basis</h2>
        <p>
          The lawful basis depends on the specific processing. SalonAI separates
          service operation from optional marketing so marketing consent is not
          treated as a condition of receiving ordinary salon services.
        </p>

        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>
                  Purpose
                </th>
                <th>
                  Intended basis
                </th>
                <th>
                  Examples
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Provide requested services
                </td>
                <td>
                  Contract / steps requested before a contract
                </td>
                <td>
                  Accounts, bookings, orders, payment status and customer
                  support.
                </td>
              </tr>
              <tr>
                <td>
                  Security and reliable operation
                </td>
                <td>
                  Legitimate interests and, where applicable, legal obligation
                </td>
                <td>
                  Authentication, fraud prevention, audit logs, incident
                  investigation and service integrity.
                </td>
              </tr>
              <tr>
                <td>
                  Legal, accounting and dispute records
                </td>
                <td>
                  Legal obligation and/or legitimate interests
                </td>
                <td>
                  Records required for tax, accounting, regulatory compliance,
                  claims and dispute handling.
                </td>
              </tr>
              <tr>
                <td>
                  Optional direct marketing
                </td>
                <td>
                  Consent where required; any future statutory soft-opt-in route
                  must be separately evidenced
                </td>
                <td>
                  Promotional email, SMS or WhatsApp. Each channel is off by
                  default in SalonAI.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="legal-note">
          Special-category or other sensitive information must not be repurposed
          for advertising or unrelated profiling merely because it exists in a
          customer record. Any feature that requires an additional legal
          condition must establish that condition before processing.
        </p>
      </section>

      <section className="legal-card">
        <h2>4. Direct marketing controls</h2>
        <p>
          Email, SMS and WhatsApp marketing are separate opt-ins and are off by
          default. Transactional communications—such as account security,
          booking changes or payment/service information—are governed separately
          from optional marketing.
        </p>
        <p>
          Marketing can be turned off at any time. Marketing emails use a public
          signed preference/unsubscribe link, and supported messages may also
          expose a standards-based one-click unsubscribe mechanism. Public links
          can withdraw permission but cannot silently grant it again.
        </p>

        <div className="legal-actions">
          <Link
            to="/communication-preferences"
            className="app-button app-button-secondary"
          >
            Marketing preferences
          </Link>
          <Link
            to="/settings"
            className="app-button app-button-secondary"
          >
            Signed-in communication settings
          </Link>
        </div>
      </section>

      <section
        className="legal-card"
        id="sharing"
      >
        <h2>5. Service providers, recipients and international transfers</h2>
        <p>
          SalonAI may use specialist processors or service providers where they
          are necessary for the selected functionality. Categories can include
          hosting/cloud infrastructure, database services, communications,
          payment processing, authentication, observability/security and
          approved AI-service providers.
        </p>
        <p>
          Current integrations include Stripe for supported payment flows and
          Twilio/SendGrid for communications when those channels are enabled and
          pass production acceptance. Provider access is limited to the purpose
          of the integration and does not make the provider the authority for
          SalonAI customer data.
        </p>
        <p>
          Where personal information is transferred outside the UK or another
          applicable home jurisdiction, the operator must use an applicable
          transfer mechanism and complete the required transfer-risk/provider
          review before relying on that transfer.
        </p>
      </section>

      <section
        className="legal-card"
        id="retention"
      >
        <h2>6. How long information is kept</h2>
        <p>
          SalonAI is designed to retain personal information only for the period
          needed for the purpose for which it is processed and for applicable
          legal, accounting, security, fraud-prevention, dispute or backup
          requirements. The operator must maintain a documented retention
          schedule as processing moves into production.
        </p>
        <ul>
          <li>
            Active account, appointment and order data is retained while needed
            to provide the service and manage the customer relationship.
          </li>
          <li>
            Financial and transaction records may be retained for statutory,
            accounting, tax and dispute-resolution requirements.
          </li>
          <li>
            Security and audit records are retained according to documented
            security and operational needs.
          </li>
          <li>
            Marketing consent records and the minimum suppression evidence may
            be retained after an opt-out so that the objection continues to be
            respected.
          </li>
        </ul>
      </section>

      <section className="legal-card">
        <h2>7. Measurement, advertising, cookies and tracking</h2>
        <p>
          SalonAI is being designed to use a first-party marketing and
          measurement module rather than relying on a Windsor.ai-style data
          aggregation dependency. The planned browser measurement stack includes
          Google Analytics for analytics, Google Ads plus Meta Pixel and
          Microsoft Advertising UET for advertising/conversion attribution, and
          Hotjar for experience analytics.
        </p>
        <p>
          These non-essential browser technologies are not authorised merely by
          visiting SalonAI. They are mapped to granular consent categories and
          default to denied. The application-level consent boundary prevents the
          relevant provider script from loading until the matching category is
          positively selected.
        </p>
        <p>
          Google Search Console and Bing Webmaster Tools are also planned inputs
          to the first-party measurement module for search visibility and
          performance data. Site verification and server/API retrieval from
          those products are treated separately from behavioural browser
          tracking; if a future implementation introduces storage, profiling or
          advertising tracking, the appropriate consent control must apply
          before activation.
        </p>
        <p>
          Measurement data may later be normalised into SalonAI's own Marketing
          Data Core so the application can report acquisition, engagement,
          conversions, attribution and campaign performance from a governed
          internal model. External providers remain data sources/processors, not
          the canonical authority for SalonAI customer records.
        </p>
        <Link to="/cookies">
          Read the Cookie &amp; tracking notice
        </Link>
      </section>

      <section
        className="legal-card"
        id="rights"
      >
        <h2>8. Your privacy rights</h2>
        <p>
          Depending on the law and circumstances, rights may include access,
          rectification, erasure, restriction, data portability, withdrawal of
          consent and objection. A request may require identity verification,
          and some records may need to be retained where a legal or overriding
          requirement applies.
        </p>
        <p>
          An objection to direct marketing is handled separately: marketing is
          stopped rather than balanced against a business interest.
        </p>

        <div className="legal-actions">
          <Link
            to="/account/privacy-rights"
            className="app-button app-button-primary"
          >
            Submit a privacy request
          </Link>
          <Link
            to="/communication-preferences"
            className="app-button app-button-secondary"
          >
            Stop marketing
          </Link>
        </div>
      </section>

      <section className="legal-card">
        <h2>9. Marketing measurement and profiling safeguards</h2>
        <p>
          Analytics and advertising data must not be silently combined with
          sensitive consultation or service information for behavioural
          advertising. Audience building, attribution and campaign optimisation
          must use only the data and purposes authorised for the relevant
          integration. Where provider-side enhanced conversions, customer lists
          or similar uploads are introduced later, they require a separate
          implementation review, documented data mapping and the appropriate
          consent/lawful-basis controls before activation.
        </p>
      </section>

      <section className="legal-card">
        <h2>10. Automated and AI-assisted processing</h2>
        <p>
          SalonAI includes or may introduce AI-assisted business functions such
          as recommendations, forecasts, summaries and operational suggestions.
          The application should not treat an AI recommendation as an
          unrestricted authority to make a significant decision about a person.
          Features that could have significant effects must be separately
          assessed, access-controlled, explainable where appropriate, and routed
          through the human-review and approval controls required by the feature.
        </p>
      </section>

      <section className="legal-card">
        <h2>11. Security</h2>
        <p>
          SalonAI uses technical and organisational controls intended to protect
          personal information, including authenticated access, role-based
          permissions, encrypted transport, production secret separation,
          provider webhook verification, audit evidence and controlled release
          gates. No internet-connected service can guarantee absolute security.
        </p>
      </section>

      <section className="legal-card">
        <h2>12. Complaints and contact</h2>
        <p>
          Privacy questions and requests can be submitted using the contact
          details above or the authenticated privacy-rights area. People in the
          UK also have the right to complain to the Information Commissioner’s
          Office if they believe their data-protection rights have been
          infringed.
        </p>
      </section>

      <section className="legal-card">
        <h2>13. Version and changes</h2>
        <p>
          Privacy Notice version:{" "}
          <strong>
            {legal?.privacyPolicyVersion ||
              "2026-09"}
          </strong>
          . Material changes must be reflected in the public notice and, where
          the change affects consent, in the consent evidence collected after
          the change.
        </p>
      </section>
    </main>
  );
}
