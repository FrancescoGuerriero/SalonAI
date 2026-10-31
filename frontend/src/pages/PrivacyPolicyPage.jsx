import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getPublicLegalIdentity } from "../Services/publicLegalService.js";
import "../styles/legalCompliance.css";

function unwrap(response) {
  return response?.data ?? response ?? {};
}

export default function PrivacyPolicyPage() {
  const [legal, setLegal] = useState(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicLegalIdentity()
      .then((response) => {
        if (!active) return;
        const payload = unwrap(response);
        setLegal(payload.legal || {});
        setConfigured(payload.marketingComplianceConfigured === true);
      })
      .catch(() => {
        if (!active) return;
        setLegal({ tradingName: "SalonAI", businessName: "SalonAI" });
      });
    return () => { active = false; };
  }, []);

  const name = legal?.tradingName || legal?.businessName || "SalonAI";

  return (
    <main className="legal-page">
      <header className="legal-hero">
        <span className="legal-eyebrow">Privacy &amp; data protection</span>
        <h1>Privacy Notice</h1>
        <p>
          This notice explains how {name} processes personal information when people use the website,
          customer account, booking, commerce, communications and enabled business-service features.
        </p>
      </header>

      {!configured ? (
        <div className="legal-warning" role="status">
          The public legal identity is not yet fully configured. Optional marketing remains fail-closed
          until the controller identity, public postal address, privacy contact and preference controls
          pass production acceptance.
        </div>
      ) : null}

      <nav className="legal-quick-links" aria-label="Privacy notice sections">
        <a href="#controller">Controller</a>
        <a href="#data">Data we use</a>
        <a href="#purposes">Purposes &amp; lawful bases</a>
        <a href="#sharing">Sharing</a>
        <a href="#retention">Retention</a>
        <a href="#rights">Your rights</a>
      </nav>

      <section className="legal-card" id="controller">
        <h2>1. Who is responsible for your data?</h2>
        <dl className="legal-definition-list">
          <div>
            <dt>Controller / operator</dt>
            <dd>
              <strong>{legal?.businessName || name}</strong>
              {legal?.tradingName && legal.tradingName !== legal.businessName
                ? ` trading as ${legal.tradingName}`
                : ""}
            </dd>
          </div>
          {legal?.companyNumber ? <div><dt>Company number</dt><dd>{legal.companyNumber}</dd></div> : null}
          <div>
            <dt>Registered jurisdiction</dt>
            <dd>{legal?.registeredJurisdiction || "To be confirmed before live marketing activation"}</dd>
          </div>
          {legal?.postalAddress ? <div><dt>Postal address</dt><dd>{legal.postalAddress}</dd></div> : null}
          {legal?.privacyEmail ? (
            <div><dt>Privacy contact</dt><dd><a href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</a></dd></div>
          ) : null}
        </dl>
      </section>

      <section className="legal-card" id="data">
        <h2>2. Personal information we may process</h2>
        <div className="legal-grid">
          <article><h3>Account &amp; identity</h3><p>Name, email address, telephone number, authentication identifiers, connected sign-in providers, account role, security/session data and preferences.</p></article>
          <article><h3>Booking &amp; service</h3><p>Appointments, selected services, professional preferences, booking history, attendance, packages and information a customer chooses to provide for consultation or service delivery.</p></article>
          <article><h3>Commerce &amp; payments</h3><p>Orders, products, payment status, transaction references, deposits, refunds and fulfilment information. Raw payment-card data is intended to remain with the payment provider rather than AIIBP.</p></article>
          <article><h3>Communications</h3><p>Communication preferences, consent/withdrawal evidence, delivery status, campaign participation, support interactions and provider delivery events.</p></article>
          <article><h3>Technical &amp; security</h3><p>Request identifiers, IP/security logs, device/browser information, audit events, error information and data needed to protect accounts and operate the service.</p></article>
          <article><h3>AI-assisted features</h3><p>Where an enabled feature uses AI, relevant tenant-owned application data may be processed to provide recommendations, summaries or operational assistance subject to access controls, provenance and required human review.</p></article>
        </div>
      </section>

      <section className="legal-card" id="purposes">
        <h2>3. Why we use information and the intended lawful basis</h2>
        <p>
          The lawful basis depends on the processing. Service operation is separated from optional marketing,
          so marketing consent is not treated as a condition of receiving ordinary services.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th>Purpose</th><th>Intended basis</th><th>Examples</th></tr></thead>
            <tbody>
              <tr><td>Provide requested services</td><td>Contract / steps requested before a contract</td><td>Accounts, bookings, orders, payment status and support.</td></tr>
              <tr><td>Security and reliable operation</td><td>Legitimate interests and, where applicable, legal obligation</td><td>Authentication, fraud prevention, audit logs, incident investigation and integrity.</td></tr>
              <tr><td>Legal, accounting and dispute records</td><td>Legal obligation and/or legitimate interests</td><td>Tax, accounting, regulatory, claim and dispute records.</td></tr>
              <tr><td>Optional direct marketing</td><td>Consent where required</td><td>Promotional email, SMS or WhatsApp. Marketing channels are off by default.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="legal-note">
          Sensitive information must not be repurposed for advertising or unrelated profiling merely because it
          exists in a customer record. Any feature requiring an additional legal condition must establish it first.
        </p>
      </section>

      <section className="legal-card">
        <h2>4. Direct marketing controls</h2>
        <p>
          Email, SMS and WhatsApp marketing are separate opt-ins and are off by default. Transactional communications
          such as account security, booking changes or payment/service information are governed separately.
        </p>
        <p>
          Marketing can be stopped at any time. Public preference/unsubscribe links can withdraw permission but cannot
          silently grant it again.
        </p>
        <div className="legal-actions">
          <Link to="/communication-preferences" className="app-button app-button-secondary">Marketing preferences</Link>
          <Link to="/settings" className="app-button app-button-secondary">Signed-in communication settings</Link>
        </div>
      </section>

      <section className="legal-card" id="sharing">
        <h2>5. Service providers, recipients and international transfers</h2>
        <p>
          AIIBP tenants may use specialist providers for hosting/cloud infrastructure, database services,
          communications, payment processing, authentication, observability/security and approved AI services when
          required by enabled modules.
        </p>
        <p>
          Examples can include Stripe for supported payment flows and Twilio/SendGrid for enabled communications.
          Provider access is limited to the integration purpose and does not make the provider canonical authority for
          tenant customer data.
        </p>
        <p>
          Where personal information is transferred outside the UK or another applicable home jurisdiction, the
          operator must use an applicable transfer mechanism and complete the required transfer-risk/provider review.
        </p>
      </section>

      <section className="legal-card" id="retention">
        <h2>6. How long information is kept</h2>
        <p>
          Personal information is retained only for the period needed for the relevant purpose and applicable legal,
          accounting, security, fraud-prevention, dispute or backup requirements. Each tenant/operator must maintain a
          documented production retention schedule.
        </p>
        <ul>
          <li>Active account, appointment and order data is kept while needed to provide the service and manage the relationship.</li>
          <li>Financial and transaction records may be retained for statutory, accounting, tax and dispute requirements.</li>
          <li>Security and audit records are retained according to documented security and operational needs.</li>
          <li>Consent and minimum suppression evidence may be retained after opt-out so the objection remains respected.</li>
        </ul>
      </section>

      <section className="legal-card">
        <h2>7. Measurement, advertising, cookies and tracking</h2>
        <p>
          AIIBP provides first-party marketing, analytics and Data Hub capabilities that can connect approved external
          measurement providers. The configured browser measurement stack may include Google Analytics, Google Ads,
          Meta Pixel, Microsoft Advertising UET and Hotjar where the tenant has enabled them and the required consent
          boundary is satisfied.
        </p>
        <p>
          Non-essential browser technologies are mapped to granular consent categories and default to denied. Relevant
          provider scripts must not load until the matching category is positively selected.
        </p>
        <p>
          Google Search Console and Bing Webmaster Tools may also provide search visibility/performance data through
          server/API connections. Verification or server-side retrieval is treated separately from behavioural browser
          tracking unless storage, profiling or advertising functionality is introduced.
        </p>
        <p>
          Measurement data may be normalised into the AIIBP Marketing Data Core so acquisition, engagement,
          conversions, attribution and campaign performance can be reported from a governed tenant-owned model.
          External providers remain data sources/processors rather than canonical customer-record authority.
        </p>
        <Link to="/cookies">Read the Cookie &amp; tracking notice</Link>
      </section>

      <section className="legal-card" id="rights">
        <h2>8. Your privacy rights</h2>
        <p>
          Depending on the law and circumstances, rights may include access, rectification, erasure, restriction,
          portability, withdrawal of consent and objection. Requests may require identity verification and some records
          may need to be retained where a legal or overriding requirement applies.
        </p>
        <p>An objection to direct marketing is handled separately: marketing is stopped rather than balanced against a business interest.</p>
        <div className="legal-actions">
          <Link to="/account/privacy-rights" className="app-button app-button-primary">Submit a privacy request</Link>
          <Link to="/communication-preferences" className="app-button app-button-secondary">Stop marketing</Link>
        </div>
      </section>

      <section className="legal-card">
        <h2>9. Marketing measurement and profiling safeguards</h2>
        <p>
          Analytics and advertising data must not be silently combined with sensitive consultation or service
          information for behavioural advertising. Audience building, attribution and campaign optimisation may use
          only data and purposes authorised for the relevant integration. Enhanced conversions, customer-list uploads
          or similar functionality require separate review and documented data mapping before activation.
        </p>
      </section>

      <section className="legal-card">
        <h2>10. Automated and AI-assisted processing</h2>
        <p>
          AIIBP can provide recommendations, forecasts, summaries and operational suggestions. An AI recommendation is
          not unrestricted authority to make a significant decision about a person. Features with significant effects
          require separate assessment, appropriate access controls, explainability/provenance where needed and the
          human-review/approval controls defined by the feature.
        </p>
      </section>

      <section className="legal-card">
        <h2>11. Security</h2>
        <p>
          AIIBP uses technical and organisational controls including authenticated access, role-based permissions,
          encrypted transport, production secret separation, provider webhook verification, tenant isolation, audit
          evidence and controlled release gates. No internet-connected service can guarantee absolute security.
        </p>
      </section>

      <section className="legal-card">
        <h2>12. Complaints and contact</h2>
        <p>
          Privacy questions and requests can be submitted using the contact details above or the authenticated
          privacy-rights area. People in the UK may also complain to the Information Commissioner&apos;s Office if they
          believe their data-protection rights have been infringed.
        </p>
      </section>
    </main>
  );
}
