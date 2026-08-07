const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const requestBuckets = new Map();

function clientKey(request) {
  return String(
    request.ip ||
      request.headers["x-forwarded-for"] ||
      request.socket?.remoteAddress ||
      "unknown"
  ).split(",")[0].trim();
}

export function chatbotRateLimit(request, response, next) {
  const now = Date.now();
  const key = clientKey(request);
  const current = requestBuckets.get(key);

  if (!current || now >= current.resetAt) {
    requestBuckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return next();
  }

  current.count += 1;

  if (current.count > MAX_REQUESTS) {
    response.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((current.resetAt - now) / 1000)))
    );

    return response.status(429).json({
      success: false,
      message: "Too many assistant messages. Please wait a moment and try again.",
      code: "TOO_MANY_REQUESTS",
    });
  }

  return next();
}

const cleanup = setInterval(() => {
  const now = Date.now();

  for (const [key, bucket] of requestBuckets.entries()) {
    if (now >= bucket.resetAt) {
      requestBuckets.delete(key);
    }
  }
}, WINDOW_MS);

cleanup.unref?.();

export default chatbotRateLimit;
