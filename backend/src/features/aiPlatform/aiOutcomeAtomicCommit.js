import mongoose from "mongoose";
import { createServiceError } from "../../shared/serviceError.js";

/**
 * Keep an AI outcome, the related run update and its audit in one MongoDB
 * transaction. No standalone-write fallback is permitted.
 * This helper never grants an entitlement or executes an AI proposal.
 */
export async function withAiOutcomeTransaction(work, {
  startSession = () => mongoose.startSession(),
} = {}) {
  if (typeof work !== "function" || typeof startSession !== "function") {
    throw createServiceError("Invalid AI outcome transaction contract.", 500, {
      code: "AI_OUTCOME_TRANSACTION_INVALID",
    });
  }
  const session = await startSession();
  if (!session || typeof session.withTransaction !== "function" ||
      typeof session.endSession !== "function") {
    if (session && typeof session.endSession === "function") await session.endSession();
    throw createServiceError("AI outcome recording requires MongoDB transactions.", 503, {
      code: "AI_OUTCOME_TRANSACTION_UNAVAILABLE",
    });
  }
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
