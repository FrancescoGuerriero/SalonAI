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
