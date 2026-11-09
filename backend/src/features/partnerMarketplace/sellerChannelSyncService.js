import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import AuditLog from "../../models/AuditLog.js";
import SellerChannelStagingRecord from "../../models/SellerChannelStagingRecord.js";
import SellerChannelSyncCheckpoint from "../../models/SellerChannelSyncCheckpoint.js";
import SellerChannelImportRun from "../../models/SellerChannelImportRun.js";
import { createServiceError } from "../../shared/serviceError.js";
import { fetchSellerChannelSnapshot } from "./sellerChannelAdapter.js";
import { encryptIntegrationSecret, decryptIntegrationSecret } from "../integrationPlatform/integrationSecrets.js";
import { withSellerImportLease } from "./sellerChannelImportLeaseService.js";
import { assertSellerRecoveryReviewed } from "./sellerChannelRecoveryGuard.js";

function requiredId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`Valid ${field} is required for seller sync.`, 400, {
      code: "SELLER_SYNC_INVALID_AUTHORITY",
    });
  }
  return value;
}
function stageRecord(record, kind) {
  const externalId = kind === "listings" ? record.sku : record.externalOrderId;
  if (!externalId || String(externalId).length > 200) {
    throw createServiceError("Provider returned an unidentifiable seller record.", 502, {
      code: "SELLER_SYNC_EXTERNAL_ID_INVALID",
    });
  }
  const quantity = record.quantity == null ? null : Number(record.quantity);
  if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 0)) {
    throw createServiceError("Provider returned invalid inventory quantity.", 502, {
      code: "SELLER_SYNC_QUANTITY_INVALID",
    });
  }
  return {
    externalId: String(externalId),
    sourceRecord: {
      sku: kind === "listings" ? String(record.sku || "") : "",
      status: String(record.status || "").slice(0, 120),
      quantity,
      placedAt: kind === "orders" && record.placedAt ? new Date(record.placedAt) : null,
      amount: kind === "orders" ? String(record.total ?? "").slice(0, 100) : "",
      currency: kind === "orders" ? String(record.currency || "").slice(0, 20) : "",
      fulfillmentStatus: kind === "orders" ? String(record.fulfillmentStatus || "").slice(0, 120) : "",
    },
  };
}

/**
 * Human-invoked staging only. Canonical Product, Inventory and Order remain
 * authoritative; there is no automatic stock, payment or fulfilment write.
 */
async function stageSellerChannelSnapshotUnlocked(connection, kind, {
  businessId, actorId, requestId = "", resume = false,
  readSnapshot = fetchSellerChannelSnapshot,
  recordsModel = SellerChannelStagingRecord,
  checkpointModel = SellerChannelSyncCheckpoint,
  auditModel = AuditLog, assertLeaseOwned = async () => {},
  recordProgress = async () => {},
} = {}) {
  requiredId(businessId, "business");
  requiredId(actorId, "actor");
  if (!connection || String(connection.business) !== String(businessId) ||
      connection.status !== "connected") {
    throw createServiceError("Seller connection is not owned and connected for this business.", 403, {
      code: "SELLER_SYNC_AUTHORITY_REQUIRED",
    });
  }
  if (!["listings", "orders"].includes(kind)) {
    throw createServiceError("Only listings and orders can be staged.", 400, {
      code: "SELLER_SYNC_UNSUPPORTED_KIND",
    });
  }
  let resumeCursor = null;
  if (resume === true) {
    const checkpoint = await checkpointModel.findOne({
      business: businessId, connection: connection._id, kind, provider: connection.provider,
    }).lean();
    if (!checkpoint?.resumeSupported || !checkpoint.cursorCiphertext ||
      !checkpoint.cursorIv || !checkpoint.cursorTag) {
      throw createServiceError("No resumable seller checkpoint is available.", 409, {
        code: "SELLER_SYNC_RESUME_UNAVAILABLE",
      });
    }
    resumeCursor = decryptIntegrationSecret({
      ciphertext: checkpoint.cursorCiphertext,
      iv: checkpoint.cursorIv,
      tag: checkpoint.cursorTag,
    });
  }
  const snapshot = await readSnapshot(connection, kind, {
    resumeCursor, includeResumeCursor: true,
  });
  if (!Array.isArray(snapshot?.records) || snapshot.records.length > 50 ||
      snapshot.provider !== connection.provider || snapshot.kind !== kind) {
    throw createServiceError("Invalid seller channel snapshot.", 502, {
      code: "SELLER_SYNC_SNAPSHOT_INVALID",
    });
  }
  await recordProgress("provider_read");
  const staged = snapshot.records.map((record) => stageRecord(record, kind));
  if (new Set(staged.map((record) => record.externalId)).size !== staged.length) {
    throw createServiceError("Seller snapshot contains duplicate external identifiers.", 502, {
      code: "SELLER_SYNC_DUPLICATE_SOURCE_IDS",
    });
  }
  const hasContinuation = snapshot.nextPageAvailable === true;
  const continuation = hasContinuation ? snapshot.internalResumeCursor : null;
  if (hasContinuation && (typeof continuation !== "string" || !continuation ||
    continuation.length > 4096)) {
    throw createServiceError("Seller provider continuation is unavailable.", 502, {
      code: "SELLER_SYNC_RESUME_CURSOR_MISSING",
    });
  }
  const secured = continuation ? encryptIntegrationSecret(continuation) : null;
  const observed = new Date();
  const writes = staged.map((record) => ({
    updateOne: {
      filter: { business: businessId, connection: connection._id, kind, externalId: record.externalId },
      update: {
        $set: {
          sourceRecord: record.sourceRecord,
          provider: connection.provider,
          lastObservedAt: observed,
        },
        $setOnInsert: {
          business: businessId, connection: connection._id, kind, externalId: record.externalId,
        },
      },
      upsert: true,
    },
  }));
  await assertLeaseOwned();
  if (writes.length) await recordsModel.bulkWrite(writes, { ordered: true });
  await recordProgress("staged", { stagedCount: writes.length });
  // Source observation is complete only for this bounded request; do not
  // persist provider cursors or claim full historical reconciliation.
  await assertLeaseOwned();
  await checkpointModel.findOneAndUpdate({
    business: businessId, connection: connection._id, kind,
  }, {
    $set: {
      provider: connection.provider, lastObservedAt: observed,
      stagedCount: writes.length, pagesFetched: snapshot.pagesFetched ?? null,
      sourcePageComplete: snapshot.completeWithinLimit === true,
      resumeSupported: Boolean(secured),
      cursorCiphertext: secured?.ciphertext || "",
      cursorIv: secured?.iv || "",
      cursorTag: secured?.tag || "",
    },
    $setOnInsert: { business: businessId, connection: connection._id, kind },
  }, { upsert: true, new: true });

  await recordProgress("checkpointed");
  await assertLeaseOwned();
  await auditModel.create({
    actor: actorId, action: "seller_channel.snapshot_staged", resourceType: "IntegrationConnection",
    resourceId: String(connection._id), requestId,
    metadata: { businessId: String(businessId), provider: connection.provider, kind, count: writes.length,
      sourcePageComplete: snapshot.completeWithinLimit === true, pagesFetched: snapshot.pagesFetched ?? null },
  });
  return Object.freeze({
    provider: connection.provider, kind, stagedCount: writes.length,
    uniqueExternalIds: writes.length, sourcePageComplete: snapshot.completeWithinLimit === true,
    pagesFetched: snapshot.pagesFetched ?? null, resumeAvailable: Boolean(secured),
    canonicalRecordsWritten: 0,
    listingPublicationEnabled: false, fulfillmentWritesEnabled: false,
    state: "staging_only", productionAccepted: false,
  });
}

/**
 * Import lease surrounds provider fetch, stage, checkpoint and audit as one
 * non-overlapping operation. It does not confer Commerce write authority.
 */
export async function stageSellerChannelSnapshot(connection, kind, options = {}) {
  const businessId = options.businessId;
  requiredId(businessId, "business");
  requiredId(options.actorId, "actor");
  if (!connection || String(connection.business) !== String(businessId) ||
      connection.status !== "connected") {
    throw createServiceError("Seller connection is not owned and connected for this business.", 403, {
      code: "SELLER_SYNC_AUTHORITY_REQUIRED",
    });
  }
  if (!["listings", "orders"].includes(kind)) {
    throw createServiceError("Only listings and orders can be staged.", 400, {
      code: "SELLER_SYNC_UNSUPPORTED_KIND",
    });
  }
  return withSellerImportLease({
    businessId, connectionId: connection._id, kind, leaseModel: options.leaseModel,
  }, async (assertLeaseOwned) => {
    const runModel = options.runModel || SellerChannelImportRun;
    const recovery = await assertSellerRecoveryReviewed({
      runModel, businessId, connection, kind,
      recoveryAcknowledged: options.recoveryAcknowledged === true,
    });
    const runId = randomUUID();
    const scope = { business: businessId, connection: connection._id, kind, runId };
    await runModel.create({
      ...scope, provider: connection.provider, state: "started", startedAt: new Date(),
      recoveryReviewAcknowledged: recovery.recoveryAcknowledged,
    });
    let phase = "provider_or_validation";
    const recordProgress = async (state, extras = {}) => {
      await assertLeaseOwned();
      await runModel.updateOne(scope, { $set: { state, ...extras } });
      phase = state === "staged" ? "checkpoint" :
        state === "checkpointed" ? "audit" : "staging";
    };
    try {
      const result = await stageSellerChannelSnapshotUnlocked(connection, kind, {
        ...options, assertLeaseOwned, recordProgress,
      });
      await runModel.updateOne(scope, {
        $set: { state: "completed", finishedAt: new Date() },
      });
      return Object.freeze({
        ...result,
        recoveryReviewAcknowledged: recovery.recoveryAcknowledged,
      });
    } catch (error) {
      // This journal is diagnostic; preserve the original error if the
      // database also fails while recording an unsuccessful attempt.
      try {
        await runModel.updateOne(scope, {
          $set: {
            state: "failed", failureClass: phase,
            finishedAt: new Date(),
          },
        });
      } catch {
        // Read-only recovery status will identify an abandoned started run.
      }
      throw error;
    }
  });
}
