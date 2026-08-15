const REQUIRED_PRODUCTION_VARIABLES = [
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "FRONTEND_URL",
];

function readBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readMode(value, fallback) {
  return String(value || fallback)
    .trim()
    .toLowerCase();
}

function missingVariables(keys) {
  return keys.filter((key) => !String(process.env[key] || "").trim());
}

function assertRequired(keys, label) {
  const missing = missingVariables(keys);

  if (missing.length > 0) {
    throw new Error(
      `Missing required ${label} environment variables: ${missing.join(", ")}`
    );
  }
}

function validateStripeConfiguration(isProduction) {
  const mode = readMode(process.env.PAYMENT_PROVIDER_MODE, "console");

  if (!["mock", "console", "demo", "stripe"].includes(mode)) {
    throw new Error(
      "PAYMENT_PROVIDER_MODE must be mock, console, demo or stripe."
    );
  }

  if (mode !== "stripe") {
    return;
  }

  assertRequired(
    ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    "Stripe"
  );

  if (!String(process.env.STRIPE_SECRET_KEY).startsWith("sk_")) {
    throw new Error("STRIPE_SECRET_KEY must be a Stripe secret key beginning with sk_.");
  }

  if (!String(process.env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_")) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret beginning with whsec_."
    );
  }

  if (
    isProduction &&
    String(process.env.STRIPE_SECRET_KEY).startsWith("sk_test_")
  ) {
    throw new Error(
      "Production cannot start with a Stripe test secret key while PAYMENT_PROVIDER_MODE=stripe."
    );
  }
}

function validateWhatsAppConfiguration(isProduction) {
  const mode = readMode(process.env.WHATSAPP_PROVIDER_MODE, "mock");

  if (!["mock", "console", "sandbox", "twilio", "live"].includes(mode)) {
    throw new Error(
      "WHATSAPP_PROVIDER_MODE must be mock, console, sandbox, twilio or live."
    );
  }

  if (!["twilio", "live"].includes(mode)) {
    return;
  }

  assertRequired(
    ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"],
    "Twilio WhatsApp"
  );

  if (!String(process.env.TWILIO_ACCOUNT_SID).startsWith("AC")) {
    throw new Error("TWILIO_ACCOUNT_SID must begin with AC.");
  }

  if (
    isProduction &&
    !process.env.WHATSAPP_WEBHOOK_URL &&
    !process.env.TWILIO_WEBHOOK_BASE_URL
  ) {
    throw new Error(
      "Production WhatsApp delivery requires WHATSAPP_WEBHOOK_URL or TWILIO_WEBHOOK_BASE_URL for deterministic webhook signature validation."
    );
  }
}

export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === "production";
  const missing = isProduction
    ? REQUIRED_PRODUCTION_VARIABLES.filter((key) => !process.env[key])
    : [];

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`
    );
  }

  if (
    isProduction &&
    (
      process.env.JWT_SECRET?.length < 32 ||
      process.env.JWT_REFRESH_SECRET?.length < 32
    )
  ) {
    throw new Error(
      "JWT secrets must each contain at least 32 characters in production."
    );
  }

  if (
    isProduction &&
    process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    throw new Error(
      "JWT_SECRET and JWT_REFRESH_SECRET must be different values in production."
    );
  }

  const accessTokenMinutes = readNumber(
    process.env.ACCESS_TOKEN_MINUTES,
    15
  );
  const refreshTokenDays = readNumber(
    process.env.REFRESH_TOKEN_DAYS,
    7
  );
  const passwordResetMinutes = readNumber(
    process.env.PASSWORD_RESET_MINUTES,
    20
  );

  if (accessTokenMinutes <= 0) {
    throw new Error(
      "ACCESS_TOKEN_MINUTES must be greater than zero."
    );
  }

  if (refreshTokenDays <= 0) {
    throw new Error(
      "REFRESH_TOKEN_DAYS must be greater than zero."
    );
  }

  if (passwordResetMinutes <= 0) {
    throw new Error(
      "PASSWORD_RESET_MINUTES must be greater than zero."
    );
  }

  validateStripeConfiguration(isProduction);
  validateWhatsAppConfiguration(isProduction);
}

validateEnvironment();

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: readNumber(process.env.PORT, 5000),
  mongoUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/salonai",
  frontendUrl:
    process.env.FRONTEND_URL ||
    "http://localhost:5173",
  trustProxy: readBoolean(
    process.env.TRUST_PROXY,
    false
  ),
  logLevel:
    process.env.LOG_LEVEL ||
    "info",
  requestBodyLimit:
    process.env.REQUEST_BODY_LIMIT ||
    "1mb",
  jwtSecret:
    process.env.JWT_SECRET ||
    "development-only-secret",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    "development-only-refresh-secret",
  accessTokenMinutes: readNumber(
    process.env.ACCESS_TOKEN_MINUTES,
    15
  ),
  refreshTokenDays: readNumber(
    process.env.REFRESH_TOKEN_DAYS,
    7
  ),
  passwordResetMinutes: readNumber(
    process.env.PASSWORD_RESET_MINUTES,
    20
  ),
  rateLimitWindowMs: readNumber(
    process.env.RATE_LIMIT_WINDOW_MS,
    900000
  ),
  rateLimitMax: readNumber(
    process.env.RATE_LIMIT_MAX,
    300
  ),
  authRateLimitMax: readNumber(
    process.env.AUTH_RATE_LIMIT_MAX,
    20
  ),
  paymentProviderMode: readMode(
    process.env.PAYMENT_PROVIDER_MODE,
    "console"
  ),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  whatsappProviderMode: readMode(
    process.env.WHATSAPP_PROVIDER_MODE,
    "mock"
  ),
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "",
  twilioWebhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL || "",
  twilioWhatsappStatusCallbackUrl:
    process.env.TWILIO_WHATSAPP_STATUS_CALLBACK_URL ||
    process.env.TWILIO_STATUS_CALLBACK_URL ||
    "",
  version:
    process.env.APP_VERSION ||
    "dev",
  commitSha:
    process.env.COMMIT_SHA ||
    "local",
});
