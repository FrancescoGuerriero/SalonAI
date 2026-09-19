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

Recommended order:

1. configure and verify SendGrid sender/domain;
2. pass SendGrid acceptance to a dedicated test address;
3. configure Twilio SMS and WhatsApp credentials/templates;
4. pass Twilio acceptance using dedicated test recipients;
5. verify webhook/status callback endpoints;
6. enable transactional email;
7. enable SMS/WhatsApp transactional flows;
8. validate delivery ledger and retry behavior;
9. enable schedulers/reminders;
10. enable controlled campaign sending after consent/unsubscribe verification.

## Next communications increment

Provider acceptance proves that SalonAI can hand a message to the provider. The next communications increment should add/complete SendGrid Event Webhook ingestion so delivered, bounced, deferred, opened, clicked and unsubscribe events can be reconciled into SalonAI's delivery/campaign evidence without trusting SMTP acceptance as final delivery.


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

The communications activation order is now:

1. configure and verify SendGrid sender/domain;
2. configure the signed Event Webhook and verification key;
3. pass provider acceptance to a dedicated test recipient;
4. verify signed delivery callbacks reconcile into MessageDelivery;
5. configure and acceptance-test Twilio SMS/WhatsApp;
6. enable transactional channels;
7. validate retries and scheduler/reminder operation;
8. integrate SendGrid suppression/unsubscribe signals with SalonAI marketing consent;
9. enable controlled campaign/newsletter sending.
