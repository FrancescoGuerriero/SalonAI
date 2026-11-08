const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 30_000;
export const DEFAULT_AI_READ_TIMEOUT_MS = 8_000;

function failure(message, code, statusCode = 503) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

/**
 * Bound the caller's wait and request cooperative cancellation. This alone
 * cannot stop a non-cooperative underlying operation; canonical DB reads
 * must additionally enforce their own server-side time limit.
 */
export async function withBoundedAiRead(read, {
  timeoutMs = DEFAULT_AI_READ_TIMEOUT_MS,
  signal = null,
} = {}) {
  if (typeof read !== "function" || !Number.isInteger(timeoutMs) ||
      timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS ||
      (signal !== null && (typeof signal !== "object" ||
        typeof signal.addEventListener !== "function" ||
        typeof signal.removeEventListener !== "function" ||
        typeof signal.aborted !== "boolean"))) {
    throw failure("AI read deadline parameters are invalid.", "AI_READ_DEADLINE_INVALID", 400);
  }
  if (signal?.aborted) {
    throw failure("AI read was cancelled.", "AI_READ_CANCELLED", 499);
  }

  const controller = new AbortController();
  let timeoutHandle;
  let onAbort;
  const cancellation = new Promise((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(failure("AI read was cancelled.", "AI_READ_CANCELLED", 499));
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
  const deadline = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(failure("AI read exceeded its deadline.", "AI_READ_TIMEOUT", 504));
    }, timeoutMs);
  });

  try {
    // Race the deadline against a synchronously invoked cooperative read.
    // Promise.race attaches rejection handlers even to late reader errors.
    return await Promise.race([
      Promise.resolve().then(() => read({ signal: controller.signal, timeoutMs })),
      deadline,
      cancellation,
    ]);
  } finally {
    clearTimeout(timeoutHandle);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
