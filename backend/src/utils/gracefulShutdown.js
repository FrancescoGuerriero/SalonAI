import mongoose from "mongoose";
import { logger } from "../config/logger.js";

export function registerGracefulShutdown(server) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info("Graceful shutdown started", { signal });

    const forceTimer = setTimeout(() => {
      logger.error(
        "Graceful shutdown timed out",
        new Error("Shutdown timeout")
      );
      process.exit(1);
    }, 10000);

    forceTimer.unref();

    server.close(async (serverError) => {
      if (serverError) {
        logger.error("HTTP server close failed", serverError);
        process.exitCode = 1;
      }

      try {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed");
      } catch (databaseError) {
        logger.error(
          "MongoDB shutdown failed",
          databaseError
        );
        process.exitCode = 1;
      }

      clearTimeout(forceTimer);
      process.exit();
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
