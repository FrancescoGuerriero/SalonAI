# Stage 3.0 — Privacy & Direct-Marketing Compliance Baseline

## Status

This document defines the technical compliance gate that must be live before SalonAI enables SendGrid marketing or any other direct-marketing channel.

It is an engineering control baseline, not a substitute for jurisdiction-specific legal advice.

## Global conservative baseline

SalonAI uses an explicit-consent baseline that is designed to satisfy or exceed common requirements across the UK/EU, United States, Canada and Australia:

- marketing is off by default;
- marketing permission is separate from transactional/service communications;
- email, SMS and WhatsApp marketing permission is recorded separately;
- consent requires an affirmative customer action;
- consent source, time, policy version and channel are auditable;
- public unsubscribe does not require authentication;
- public links can withdraw consent but cannot grant consent;
- authenticated re-consent is required to turn marketing back on;
- opt-outs are retained as evidence/suppression state;
- live marketing is fail-closed if legal sender identity or unsubscribe controls are incomplete;
- marketing email includes an unsubscribe/preference link, Privacy Notice link, legal sender name and physical postal address.

## UK baseline

UK electronic-mail marketing is governed by PECR alongside UK GDPR. The implementation therefore does not rely on pre-ticked boxes or silence. Any future use of the PECR soft opt-in must be implemented as an explicit policy path with evidence that the statutory conditions were satisfied; it must not be inferred from a customer record merely existing.

The UK GDPR right to object to direct marketing is treated as absolute. A withdrawal prevents future marketing use while allowing the minimum suppression evidence required to honour the objection.

## International baseline

The same technical controls also support:
- U.S. CAN-SPAM sender identification, physical postal address and opt-out requirements;
- Canadian CASL consent, identification and unsubscribe requirements;
- Australian Spam Act consent, sender identification and unsubscribe requirements.

Jurisdiction-specific deadlines and exceptions remain policy configuration, not reasons to weaken the default consent model.

## Public surfaces

- `/privacy` — public Privacy Notice.
- `/communication-preferences/:token` — signed public marketing opt-out/preferences link.
- `/settings` — authenticated communication settings and re-consent.

## Production configuration

Before live marketing can become ready, configure:

- `LEGAL_BUSINESS_NAME`
- `LEGAL_TRADING_NAME`
- `LEGAL_COMPANY_NUMBER` when applicable
- `LEGAL_REGISTERED_JURISDICTION`
- `LEGAL_POSTAL_ADDRESS`
- `PRIVACY_CONTACT_EMAIL`
- `PRIVACY_POLICY_VERSION`
- `PRIVACY_POLICY_URL`
- `MARKETING_PREFERENCE_URL`
- `MARKETING_PREFERENCE_TOKEN_SECRET` (dedicated random value of at least 32 characters preferred)

Do not use a private residential address unless the business intends it to be publicly disclosed.

## Consent authority

Generic customer create/update endpoints are not consent authorities. Marketing consent is changed only through governed communication-preference workflows or later audited staff-assisted consent tooling.

## Cookies and tracking

This baseline does not authorise non-essential analytics, advertising cookies or marketing pixels. Such technologies remain disabled unless a separate consent/measurement implementation establishes the applicable legal basis and user controls.

## SendGrid gate

SendGrid marketing readiness inherits this compliance gate. Even with valid SendGrid credentials, sender authentication and webhook configuration, live marketing remains blocked until the legal identity/address/privacy/preference controls above are ready.

Transactional/service email remains a separate purpose and must not contain promotional content merely to bypass marketing controls.
