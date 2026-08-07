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
  version:
    process.env.APP_VERSION ||
    "dev",
  commitSha:
    process.env.COMMIT_SHA ||
    "local",
});
