import "dotenv/config";

function configured(value) {
  return Boolean(
    String(value || "").trim()
  );
}

const paymentMode =
  String(
    process.env
      .PAYMENT_PROVIDER_MODE ||
      "console"
  )
    .trim()
    .toLowerCase();

const whatsappMode =
  String(
    process.env
      .WHATSAPP_PROVIDER_MODE ||
      "console"
  )
    .trim()
    .toLowerCase();

const report = {
  payment: {
    mode:
      paymentMode,
    stripeSecret:
      configured(
        process.env
          .STRIPE_SECRET_KEY
      ),
    stripeWebhookSecret:
      configured(
        process.env
          .STRIPE_WEBHOOK_SECRET
      ),
    readyForStripeTest:
      paymentMode ===
        "stripe" &&
      configured(
        process.env
          .STRIPE_SECRET_KEY
      ) &&
      configured(
        process.env
          .STRIPE_WEBHOOK_SECRET
      ),
  },

  whatsapp: {
    mode:
      whatsappMode,
    twilioAccountSid:
      configured(
        process.env
          .TWILIO_ACCOUNT_SID
      ),
    twilioAuthToken:
      configured(
        process.env
          .TWILIO_AUTH_TOKEN
      ),
    whatsappFrom:
      configured(
        process.env
          .TWILIO_WHATSAPP_FROM
      ),
    readyForTwilioTest:
      [
        "twilio",
        "live",
      ].includes(
        whatsappMode
      ) &&
      configured(
        process.env
          .TWILIO_ACCOUNT_SID
      ) &&
      configured(
        process.env
          .TWILIO_AUTH_TOKEN
      ) &&
      configured(
        process.env
          .TWILIO_WHATSAPP_FROM
      ),
  },
};

console.log(
  JSON.stringify(
    report,
    null,
    2
  )
);
