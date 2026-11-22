import mongoose from "mongoose";
import { createServiceError } from "../../shared/serviceError.js";

/**
 * Atomic source-ingestion commit. Excludes external provider calls and lock
 * acquisition. Never writes canonical Commerce data.
 *
 * Must be explicitly opted into by a trusted server-side caller only.
 * Transactions require an appropriately configured MongoDB replica set.
 * Fail closed if session/transaction support is missing; no partial fallback.
 */
export async function withSellerAtomicSourceCommit(work, {
  startSession = () => mongoose.startSession(),
} = {}) {
  if (typeof work !== "function" || typeof startSession !== "function") {
    throw createServiceError("Invalid seller atomic commit contract.", 500, {
      code: "SELLER_ATOMIC_COMMIT_INVALID",
    });
  }
  const session = await startSession();
  if (!session || typeof session.withTransaction !== "function" ||
      typeof session.endSession !== "function") {
    throw createServiceError("Seller atomic staging requires MongoDB transactions.", 503, {
      code: "SELLER_ATOMIC_COMMIT_UNAVAILABLE",
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
