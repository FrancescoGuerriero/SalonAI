import mongoose from "mongoose";

const counters = {
  requests: 0,
  errors: 0,
  totalDurationMs: 0,
};

export function metricsMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    counters.requests += 1;
    counters.totalDurationMs += durationMs;

    if (res.statusCode >= 500) {
      counters.errors += 1;
    }
  });

  next();
}

export function getSystemMetrics() {
  const memory = process.memoryUsage();

  return {
    process: {
      uptimeSeconds: process.uptime(),
      nodeVersion: process.version,
      memoryBytes: memory,
    },
    http: {
      requests: counters.requests,
      errors: counters.errors,
      averageDurationMs:
        counters.requests > 0
          ? counters.totalDurationMs / counters.requests
          : 0,
    },
    database: {
      readyState: mongoose.connection.readyState,
    },
  };
}
