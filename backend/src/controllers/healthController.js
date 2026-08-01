import mongoose from "mongoose";
import { env } from "../config/env.js";
import { getSystemMetrics } from "../services/systemMetricsService.js";

export function live(req, res) {
  res.json({
    success: true,
    status: "live",
    version: env.version,
    commit: env.commitSha,
    timestamp: new Date().toISOString(),
  });
}

export function ready(req, res) {
  const databaseReady =
    mongoose.connection.readyState === 1;

  const status = databaseReady ? 200 : 503;

  res.status(status).json({
    success: databaseReady,
    status: databaseReady ? "ready" : "not_ready",
    dependencies: {
      mongodb: databaseReady ? "up" : "down",
    },
  });
}

export function dependencies(req, res) {
  res.json({
    success: true,
    dependencies: {
      mongodb: {
        readyState: mongoose.connection.readyState,
      },
      aiService: {
        status: "configure-active-health-check",
      },
      notificationProviders: {
        status: "configure-provider-health-checks",
      },
    },
  });
}

export function metrics(req, res) {
  res.json({
    success: true,
    metrics: getSystemMetrics(),
  });
}
