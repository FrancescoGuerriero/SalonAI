# SalonAI Communications Go-Live

This document defines the provider boundary for the communications phase of the SalonAI product roadmap.

## Provider map

SalonAI keeps one internal communication model while provider adapters remain replaceable.

| Channel | Production provider | SalonAI delivery path |
| --- | --- | --- |
| Transactional email | Twilio SendGrid | message delivery service -> email delivery service -> SendGrid SMTP relay |
| Campaign/newsletter email | Twilio SendGrid | campaign delivery -> delivery ledger -> email delivery service -> SendGrid SMTP relay |
| SMS | Twilio Messaging | message delivery service -> SMS delivery service -> Twilio |
| WhatsApp | Twilio WhatsApp provider when selected | WhatsApp provider adapter -> Twilio |

The existing Meta WhatsApp adapter remains available as an architectural alternative, but the current owner direction is to use Twilio for the communications stack.

## Why SendGrid uses SMTP

SendGrid supports SMTP relay. SalonAI therefore reuses its hardened email delivery engine rather than adding a second SDK-specific email implementation.

When:

`EMAIL_PROVIDER=sendgrid`

SalonAI derives:

- SMTP host: `smtp.sendgrid.net`
- SMTP username: `apikey`
- SMTP password: `SENDGRID_API_KEY`

Explicit `SMTP_*` values can still override these defaults when needed.

## Production configuration

Keep all secrets outside source control.

Minimum SendGrid configuration:

```text
MESSAGE_DELIVERY_MODE=live
EMAIL_DELIVERY_ENABLED=true
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=<secret>
EMAIL_FROM_NAME=SalonAI
EMAIL_FROM_ADDRESS=<verified SendGrid sender/domain address>
EMAIL_REPLY_TO=<reply address>
```

Before enabling account email verification, the sender/domain and real provider acceptance test must pass.

### Safe SendGrid readiness check

Before sending any real email, run:

```bash
npm run sendgrid:readiness
```

The command is non-destructive: it does not send email and does not print the SendGrid API key or Event Webhook public key. It checks the application-side and provider-attestation prerequisites required before the controlled acceptance run.

A zero exit code means the environment is ready for `npm run sendgrid:acceptance`. A non-zero exit code prints the remaining blockers and next steps.

## Real-provider acceptance

Acceptance sends a real message and is therefore deliberately gated.

Set a dedicated test recipient:

```text
SENDGRID_ACCEPTANCE_TO=<test recipient>
```

For the one deliberate command only, provide:

```text
SENDGRID_ACCEPTANCE_CONFIRM=RUN_SENDGRID_EMAIL_ACCEPTANCE
```

Run:

```bash
npm run sendgrid:acceptance
```

The acceptance flow:

1. validates the live SendGrid configuration;
2. verifies the SMTP transport;
3. sends exactly one acceptance email;
4. reports a masked recipient and provider message identifier.

It does not expose the API key.

SMS/WhatsApp real-provider acceptance remains:

```bash
npm run twilio:acceptance
```

with its separate deliberate confirmation token and dedicated test recipients.

## Transactional email and newsletters

Both transactional and campaign email use the same authoritative delivery service.

Campaign/newsletter selection remains governed by SalonAI rather than by the provider:

- communication consent is required by default;
- unsubscribed customers are excluded by default;
- invalid recipients are excluded;
- delivery attempts are recorded in the SalonAI message-delivery ledger;
- scheduler and retry controls remain independent of provider credentials.

SendGrid being configured does not itself authorise marketing contact.

## Production activation order

Do not switch all communications on simultaneously.

Recommended order for the remaining communications work:

1. preserve the existing tested Twilio SMS/WhatsApp, WhatsApp bot and WhatsApp booking baseline;
2. configure and verify the SendGrid sender/domain;
3. configure the signed SendGrid Event Webhook and public verification key;
4. run `npm run sendgrid:readiness`;
5. pass SendGrid acceptance to a dedicated test address;
6. verify the signed SendGrid delivery callback reconciles into SalonAI;
7. enable transactional email;
8. validate delivery ledger, scheduler/reminders and retry recovery;
9. enable controlled campaign sending only after consent/suppression verification.

Do not redesign or re-accept the already-tested WhatsApp/bot/WhatsApp-booking subsystem unless a regression is found.

## Current communications increment

Provider acceptance proves that SalonAI can hand a message to the provider. Signed SendGrid Event Webhook ingestion now reconciles provider delivery and engagement evidence without trusting SMTP acceptance as final delivery.


## SendGrid Event Webhook reconciliation

SMTP acceptance is not treated as final delivery evidence. SalonAI exposes a dedicated signed provider callback:

`POST /api/message-delivery/webhooks/sendgrid/events`

The route is mounted before the general JSON parser because SendGrid signs the original raw request bytes.

Required production configuration:

```text
SENDGRID_EVENT_WEBHOOK_ENABLED=true
SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY=<SendGrid signed Event Webhook public key>
```

Production live SendGrid email fails closed unless the signed callback is enabled and a public verification key is configured.

### Event handling

SalonAI stores a privacy-limited event ledger keyed by SendGrid `sg_event_id` so repeated provider callbacks are idempotent.

Delivery events:
- `processed` can advance an early delivery to accepted;
- `delivered` marks a matching delivery delivered;
- `deferred` is retained as evidence but does not regress the SalonAI delivery status;
- `bounce` marks a strongly matched message undelivered;
- `dropped` marks a strongly matched message failed.

The provider event is matched to SalonAI by strong message identifiers. The SMTP `smtp-id` is normalised and compared with the SMTP Message-ID stored in the MessageDelivery ledger. Recipient email is not used as a fallback identity.

Engagement/suppression events such as `open`, `click`, `spamreport`, `unsubscribe`, `group_unsubscribe` and `group_resubscribe` are persisted as provider evidence but do not alter delivery status.

The event ledger deliberately excludes recipient email, clicked URLs, IP addresses and user-agent strings. Suppression/consent mutation is a separate governed marketing increment.

### Go-live implications

The remaining communications activation order is now:

1. keep the already-tested Twilio SMS/WhatsApp, WhatsApp bot and WhatsApp booking paths unchanged;
2. configure and verify SendGrid sender/domain;
3. configure the signed Event Webhook and verification key;
4. run the safe SendGrid readiness check;
5. pass provider acceptance to a dedicated test recipient;
6. verify signed delivery callbacks reconcile into MessageDelivery;
7. enable transactional email;
8. validate retries and scheduler/reminder operation;
9. enable controlled campaign/newsletter sending after consent/suppression verification.


## SendGrid marketing suppression and local re-consent

Provider suppression evidence is reconciled into SalonAI's own marketing-consent controls before campaign/newsletter activation.

### Global email-marketing suppression

When a signed, strongly matched SendGrid event is one of:

- `unsubscribe`;
- `spamreport`;
- `group_unsubscribe`;

SalonAI withdraws **email marketing only** for the resolved local Customer:

- `communicationPreferences.promotionalMessages = false`;
- `marketing.emailConsent = false`;
- `marketing.emailSuppressed = true`, with suppression timestamp/reason;
- consent timestamps/source are updated;
- a `ConsentRecord` withdrawal is written when the Customer has a linked user account.

Channel-wide `communicationPreferences.emailUnsubscribed`, appointment reminders, service updates and the general `communicationPreferences.unsubscribed` flag are not changed by provider marketing suppression. Transactional communications therefore remain separate from marketing opt-out.

Provider suppression now has two scopes:

- SendGrid `unsubscribe` and `spamreport` create a global SalonAI email-marketing suppression;
- `group_unsubscribe` adds only the supplied SendGrid ASM group ID to the customer's group-suppression set;
- `group_resubscribe` clears only that same ASM group and never re-grants general SalonAI marketing consent.

A marketing campaign may declare `options.sendGridSuppressionGroupId`. Audience preparation and delivery-time consent checks then block only customers suppressed for that group.

### Identity boundary

Suppression mutation never trusts the email address supplied in the provider event as customer identity.

SalonAI first strongly matches the provider event to a local `MessageDelivery` using provider message identifiers. It then resolves the Customer from:

1. the trusted local `MessageDelivery.customer` reference; or
2. the trusted local `MessageDelivery.recipient.email` as a fallback.

If the Customer cannot be resolved from local delivery evidence, no marketing preference is mutated. The matched `MessageDelivery` must also carry a SalonAI `campaign` reference; otherwise the event is treated as transactional engagement evidence only and cannot mutate marketing consent or suppression state.

### Re-consent

A signed, strongly matched SendGrid `group_resubscribe` event can clear only the matching entry in `marketing.emailSuppressionGroups`. It **does not** clear global provider suppression and it **does not** re-grant SalonAI marketing consent.

Local email marketing consent can be restored only through an explicit SalonAI customer-preference action where:

- promotional messages are enabled;
- channel-wide email unsubscribe is disabled; and
- global unsubscribe is disabled.

That local preference change updates `marketing.emailConsent` and writes a consent audit record when the value changes. It does not clear provider suppression by itself.

Marketing email is therefore eligible only when both sides agree:

- SalonAI local marketing consent is granted; and
- provider marketing suppression is clear.

### Marketing activation readiness

Live SendGrid marketing/newsletter delivery is fail-closed. Transactional email remains independently available.

The provider configuration exposes a redacted marketing-readiness result. A live marketing campaign can proceed only when all of the following are true:

- `MESSAGE_DELIVERY_MODE=live`;
- email delivery is enabled with `EMAIL_PROVIDER=sendgrid`;
- the SendGrid API key is configured;
- the signed SendGrid Event Webhook is enabled and has its public key;
- `SENDGRID_SENDER_VERIFIED=true`;
- `SENDGRID_DOMAIN_AUTHENTICATED=true`;
- the controlled marketing acceptance has been completed and recorded with `SENDGRID_MARKETING_ACCEPTANCE_CONFIRMED=true`;
- `SENDGRID_MARKETING_ENABLED=true`;
- the campaign declares a positive `options.sendGridSuppressionGroupId`.

The marketing enable flag is deliberately last in the operational sequence. Enabling it in production while any provider-readiness check is incomplete causes production environment validation to fail.

For SMTP delivery, SalonAI generates the SendGrid `X-SMTPAPI` header from trusted campaign metadata using only the validated ASM group ID. Caller-supplied `X-SMTPAPI` headers are removed so application requests cannot inject list-management bypass directives.

Sandbox campaigns remain usable while provider onboarding is incomplete.

### Controlled marketing acceptance

Before setting `SENDGRID_MARKETING_ACCEPTANCE_CONFIRMED=true` or `SENDGRID_MARKETING_ENABLED=true`, run the dedicated one-off provider acceptance command:

`npm run sendgrid:marketing-acceptance`

The command requires these runtime-only inputs:

- `SENDGRID_MARKETING_ACCEPTANCE_CONFIRM=RUN_SENDGRID_MARKETING_ACCEPTANCE`;
- a dedicated `SENDGRID_MARKETING_ACCEPTANCE_TO` address;
- a positive `SENDGRID_MARKETING_ACCEPTANCE_GROUP_ID`;
- optional subject/message overrides.

The confirmation token is deliberately not stored in `.env.example`.

The acceptance service requires live SendGrid email, a configured signed Event Webhook, sender verification and domain authentication. It also refuses to run if `SENDGRID_MARKETING_ENABLED=true`, keeping acceptance ahead of activation.

The one test message carries the supplied group through the same trusted `sendGridSuppressionGroupId` metadata used by campaigns, which produces the controlled SendGrid SMTP ASM header. The result redacts the recipient and reports the provider message ID, group ID and send timestamp.

The command does **not** alter environment configuration and does **not** mark acceptance complete. After the run, verify:

1. the dedicated recipient received the test;
2. SendGrid accepted the expected provider message;
3. signed Event Webhook evidence was received for that message/group path.

Only after that evidence is confirmed should the operator set `SENDGRID_MARKETING_ACCEPTANCE_CONFIRMED=true`. Keep `SENDGRID_MARKETING_ENABLED=false` until the final activation decision.

### Campaign enforcement

Both campaign preparation and real campaign delivery now read the canonical Customer fields:

- channel-wide `communicationPreferences.emailUnsubscribed`;
- marketing preference `communicationPreferences.promotionalMessages`;
- local consent `marketing.emailConsent`;
- global provider state `marketing.emailSuppressed`;
- group-scoped provider state `marketing.emailSuppressionGroups` when the campaign declares `options.sendGridSuppressionGroupId`.

Marketing-only fields apply to marketing email campaigns, while the `appointment_reminder` campaign type does not inherit marketing-only suppression. Channel/global unsubscribe controls remain authoritative for transactional email as well.

This closes the legacy-field gap where an opt-out could exist on the Customer record but not be observed consistently by every campaign path.

### Next communications step

After this suppression/consent layer is validated and merged, the remaining go-live sequence is:

1. configure real SendGrid sender/domain, API key and signed Event Webhook;
2. perform controlled provider acceptance and callback reconciliation with a dedicated test recipient;
3. configure and acceptance-test Twilio SMS and WhatsApp;
4. enable transactional communications;
5. validate scheduler, reminders and retry recovery;
6. enable controlled marketing/newsletter sending only after consent and suppression evidence is confirmed end-to-end.
