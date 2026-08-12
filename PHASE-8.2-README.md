# SalonAI Phase 8.2 — Customer Conversion & Integrations

This pack is designed to be extracted over the current `phase-8.1-session-resilience` working branch.
It does not touch production and it keeps the Phase 8.1 access/refresh-session files intact.

## Included

- Login now includes **Forgot password?** and an in-place secure reset flow.
- Password reset tokens are random, SHA-256 hashed in MongoDB, one-time, and expire after `PASSWORD_RESET_MINUTES` (20 by default).
- Development mode exposes a local reset URL after the forgot-password request so the flow can be tested without SMTP. Production never returns the reset token.
- Navbar keeps the primary journey only: Home, Services, Stylists, Shop, Book, and Management where applicable.
- Explore, Help, My account, and Manage account are in the footer.
- Footer supports configurable Instagram, Facebook, TikTok, YouTube, and WhatsApp links. Empty social URLs are hidden instead of producing dead links.
- Public WhatsApp booking CTA is enabled when `VITE_WHATSAPP_NUMBER` is set.
- 33 services/prices from the referenced 3Thirty public menu are supplied in `backend/data/3thirty-services.json`.
- Imported 3Thirty service durations are working estimates because the source does not publish durations. They are therefore `onlineBookable: false` and route to WhatsApp until salon timings are confirmed.
- Existing Stripe Checkout and Twilio/WhatsApp backend modes are used; no second payment or messaging stack is introduced.

## 3Thirty source

Source used for service names and prices:
https://www.3thirty.co.uk/hairandbeauty.html#colour
Checked 2026-08-08.

## Validate service catalogue without writing to MongoDB

From `backend`:

```powershell
node .\scripts\seedServiceCatalogue.js --file .\data\3thirty-services.json --dry-run
```

Only after the dry-run passes and you want the services in your local database:

```powershell
node .\scripts\seedServiceCatalogue.js --file .\data\3thirty-services.json
```

## Frontend public links

Copy missing values from `frontend/.env.example` into your existing `frontend/.env`:

```dotenv
VITE_WHATSAPP_NUMBER=447700900000
VITE_WHATSAPP_MESSAGE=Hello SalonAI, I would like to book an appointment.
VITE_INSTAGRAM_URL=https://www.instagram.com/your-account
VITE_FACEBOOK_URL=https://www.facebook.com/your-page
VITE_TIKTOK_URL=https://www.tiktok.com/@your-account
VITE_YOUTUBE_URL=https://www.youtube.com/@your-channel
```

Do not use the example phone/social values literally; replace them with the salon's real public details.
Restart Vite after changing `.env`.

## Forgot password — local test

Keep SMTP disabled for the first test:

```dotenv
PASSWORD_RESET_MINUTES=20
EMAIL_PROVIDER_MODE=mock
EMAIL_DELIVERY_ENABLED=false
```

Open `/login`, choose **Forgot password?**, submit an existing account email, then click the development reset link returned by the local API. This development link is not returned when `NODE_ENV=production`.

For production email delivery, configure SMTP and set `EMAIL_DELIVERY_ENABLED=true` before release acceptance.

## Enable Stripe in local test mode

Do not put Stripe secrets in Git or in frontend files. In `backend/.env` use your Stripe sandbox/test credentials:

```dotenv
PAYMENT_PROVIDER_MODE=stripe
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
```

With the Stripe CLI authenticated, forward sandbox events to SalonAI:

```powershell
stripe listen --forward-to http://localhost:5000/api/commerce/webhooks/stripe
```

Use the `whsec_...` value printed by `stripe listen` as `STRIPE_WEBHOOK_SECRET`, restart the backend, and complete a checkout using Stripe test mode.

## Enable Twilio WhatsApp locally

Use the Twilio WhatsApp Sandbox first. In `backend/.env`:

```dotenv
WHATSAPP_PROVIDER_MODE=twilio
TWILIO_ACCOUNT_SID=REPLACE_ME
TWILIO_AUTH_TOKEN=REPLACE_ME
TWILIO_WHATSAPP_FROM=whatsapp:+REPLACE_ME
TWILIO_WEBHOOK_VALIDATION_ENABLED=true
TWILIO_WEBHOOK_BASE_URL=https://YOUR-PUBLIC-DEV-URL
```

Configure the Twilio Sandbox incoming-message webhook to POST to:

```text
https://YOUR-PUBLIC-DEV-URL/api/whatsapp/webhook
```

For local-only testing, expose port 5000 with a secure development tunnel. Keep webhook signature validation enabled.

## Validation commands

Because this Windows/npm installation has shown unreliable nested `npm run validate` wrappers, use the proven individual stages:

Backend:

```powershell
npm run check
node --input-type=module -e "await import('./src/app.js'); console.log('Backend application import passed.')"
npm test
```

Frontend:

```powershell
npm test
npm run build
```

Do not commit, push, tag, or deploy until those checks and the browser acceptance flow pass.
