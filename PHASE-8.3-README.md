# SalonAI Phase 8.3 — Payments & Messaging Activation

This package extends the existing SalonAI messaging and commerce implementation. It does not introduce a second payment stack or a second WhatsApp stack.

## Scope

### WhatsApp
- Keeps the existing conversation and WhatsApp booking workspace.
- Adds one-off outbound WhatsApp messages from the existing management WhatsApp page.
- Adds 24-hour customer-service-window enforcement.
- Requires an approved Twilio Content SID outside the 24-hour window.
- Supports Twilio `ContentSid` and `ContentVariables`.
- Requires explicit consent confirmation for a new one-off outbound message.
- Respects the existing general customer unsubscribe flag and promotional-message preference.
- Keeps conversation history in `WhatsAppConversation`.

### Stripe
- Keeps the existing Stripe Checkout implementation.
- Keeps the existing raw-body webhook signature verification.
- Handles:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
- Uses the existing idempotent `settlePaidOrder()` path so inventory is not committed twice.

## Do not put credentials in Git

Use only the untracked `backend/.env`.

### Local Twilio test-mode values

```dotenv
WHATSAPP_PROVIDER_MODE=twilio
TWILIO_ACCOUNT_SID=<your-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>
TWILIO_WHATSAPP_FROM=<your-whatsapp-sender>
TWILIO_WEBHOOK_VALIDATION_ENABLED=true
TWILIO_WEBHOOK_BASE_URL=<public HTTPS tunnel while testing inbound webhooks>
```

For the Twilio WhatsApp Sandbox, each test recipient must first join the sandbox.

### Local Stripe test-mode values

```dotenv
PAYMENT_PROVIDER_MODE=stripe
STRIPE_SECRET_KEY=<your sk_test key>
STRIPE_WEBHOOK_SECRET=<the whsec value printed by stripe listen>
```

Never paste these values into chat or commit them.

## Install

From the SalonAI project root:

```powershell
Expand-Archive `
  -Path "$env:USERPROFILE\Downloads\SalonAI_Phase_8_3_Payments_Messaging.zip" `
  -DestinationPath "." `
  -Force
```

## Validate source

```powershell
Set-Location ".\backend"

node ".\scripts\checkSource.js"

$backendTests = Get-ChildItem ".\src\test" `
  -Filter "*.test.js" `
  -Recurse |
  ForEach-Object { $_.FullName }

node --test $backendTests

Write-Host "BACKEND TESTS: $LASTEXITCODE"
```

Then:

```powershell
Set-Location "..\frontend"

node ".\node_modules\vite\bin\vite.js" build

Write-Host "FRONTEND BUILD: $LASTEXITCODE"
```

## Check configuration safely

This prints booleans only and does not print secret values:

```powershell
Set-Location "..\backend"

node ".\scripts\verifyPhase83Configuration.js"
```

## Stripe CLI local webhook

Keep SalonAI backend running on port 5000, then in another terminal:

```powershell
stripe login

stripe listen `
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired `
  --forward-to http://127.0.0.1:5000/api/commerce/webhooks/stripe
```

Use the `whsec_...` printed by that command as the local `STRIPE_WEBHOOK_SECRET`.

## WhatsApp inbound webhook

For Twilio Sandbox or a real WhatsApp sender, configure the inbound webhook to the public HTTPS URL that forwards to:

```text
/api/whatsapp/webhook
```

For production, the final URL will be:

```text
https://salonai.francescopicardi.co.uk/api/whatsapp/webhook
```

Do not point Twilio at localhost. Use a secure public tunnel during local inbound-webhook testing.

## One-off outbound messages

Open the existing management WhatsApp route:

```text
/whatsapp-booking
```

The page now contains a **One-off message** form.

Rules:
- If the customer has messaged the salon in the last 24 hours, free-form text can be sent.
- Outside that window, use an approved Twilio Content SID (`HX...`) and template variables.
- Confirm customer consent before a one-off outbound message.
- Marketing messages are blocked when the customer has disabled promotional messages.

## Production

This package is for local/test validation first.

Do not:
- use `sk_live_...` Stripe keys,
- activate a production WhatsApp sender,
- alter the live v8.0.0 deployment,
- create a release tag,
- deploy production,

until the Phase 8.3 test matrix is fully green and explicitly approved.
