import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import AuditLog from "../src/models/AuditLog.js";
import CommunicationCampaign from "../src/models/CommunicationCampaign.js";
import CommunicationCampaignRecipient from "../src/models/CommunicationCampaignRecipient.js";
import CommunicationTemplate from "../src/models/CommunicationTemplate.js";
import MessageDelivery from "../src/models/MessageDelivery.js";
import ScheduledCommunication from "../src/features/scheduler/ScheduledCommunication.js";
import {
  assertExplicitCanonicalTenantIdentity,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  loadCommunicationOwnershipSnapshot,
} from "../src/platform/tenancy/communicationOwnershipSnapshot.js";
import {
  calculateCommunicationOwnershipPlanFingerprint,
} from "../src/platform/tenancy/communicationOwnershipMigration.js";

export const COMMUNICATION_TENANT_BACKFILL_CONFIRMATION =
  "APPLY_COMMUNICATION_TENANT_BACKFILL";

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required for communications tenant backfill.");
  return uri;
}

export function assertCommunicationApplyAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  actualFingerprint,
} = {}) {
  if (!Array.isArray(args) || !args.includes("--apply")) {
    throw new Error("Communications tenant backfill requires explicit --apply.");
  }

  if (
    String(environment.COMMUNICATION_TENANT_BACKFILL_CONFIRM || "").trim() !==
    COMMUNICATION_TENANT_BACKFILL_CONFIRMATION
  ) {
    throw new Error(
      `Communications tenant backfill requires COMMUNICATION_TENANT_BACKFILL_CONFIRM=${COMMUNICATION_TENANT_BACKFILL_CONFIRMATION}.`
    );
  }

  const supplied = String(
    environment.COMMUNICATION_TENANT_BACKFILL_PLAN_FINGERPRINT || ""
  )
    .trim()
    .toLowerCase();
  const expected = String(actualFingerprint || "").trim().toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(supplied)) {
    throw new Error(
      "COMMUNICATION_TENANT_BACKFILL_PLAN_FINGERPRINT must contain the reviewed 64-character SHA-256 plan fingerprint."
    );
  }
  if (supplied !== expected) {
    throw new Error(
      "The reviewed communications backfill fingerprint no longer matches current database state. Generate and review a new dry-run plan."
    );
  }

  assertExplicitCanonicalTenantIdentity(environment);
  return true;
}

function missing(field) {
  return { $or: [{ [field]: { $exists: false } }, { [field]: null }] };
}

function modelFor(recordType) {
  if (recordType === "CommunicationCampaign") return CommunicationCampaign;
  if (recordType === "CommunicationCampaignRecipient") return CommunicationCampaignRecipient;
  if (recordType === "CommunicationTemplate") return CommunicationTemplate;
  if (recordType === "ScheduledCommunication") return ScheduledCommunication;
  if (recordType === "MessageDelivery") return MessageDelivery;
  throw new Error(`Unsupported communications migration record type: ${recordType}`);
}

async function applyOperation(operation, session) {
  const Model = modelFor(operation.recordType);
  const preconditions = [{ _id: operation.recordId }];
  if (Object.hasOwn(operation.set, "business")) preconditions.push(missing("business"));
  if (Object.hasOwn(operation.set, "location")) preconditions.push(missing("location"));

  const result = await Model.updateOne(
    preconditions.length === 1 ? preconditions[0] : { $and: preconditions },
    { $set: operation.set },
    { session }
  );

  if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
    throw new Error(
      `${operation.recordType} ownership changed after plan review or could not be applied. Transaction aborted.`
    );
  }
}

async function writeMigrationAudit({ session, snapshot, fingerprint, operationCount }) {
  await AuditLog.create(
    [
      {
        action: "tenant_migration.communication_business_location_backfill",
        resourceType: "TenantMigration",
        resourceId: fingerprint,
        before: snapshot.plan.coverage,
        after: {
          campaigns: { unownedBusiness: 0, foreignBusiness: 0, foreignLocation: 0 },
          recipients: { unownedBusiness: 0, foreignBusiness: 0, foreignLocation: 0 },
          templates: { unownedBusiness: 0, foreignBusiness: 0, foreignLocation: 0 },
          scheduledCommunications: {
            unownedBusiness: 0,
            foreignBusiness: 0,
            foreignLocation: 0,
          },
          messageDeliveries: {
            unownedBusiness: 0,
            foreignBusiness: 0,
            foreignLocation: 0,
          },
        },
        metadata: {
          schemaVersion: 1,
          targetBusinessId: String(snapshot.business._id),
          targetLocationId: String(snapshot.location._id),
          reviewedFingerprint: fingerprint,
          operationCount,
          legacyGlobalUniqueIndexCutoverIncluded: false,
          rollback: {
            strategy:
              "unset only Business/Location ownership fields assigned by this reviewed migration after explicit rollback authorisation",
            operationCount,
          },
          identifiersIncluded: false,
          piiIncluded: false,
        },
      },
    ],
    { session }
  );
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const configuration = getCanonicalSalonTenantConfiguration(environment);
  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const reviewed = await loadCommunicationOwnershipSnapshot({ configuration });
  if (!reviewed.plan.executable) {
    throw new Error("Communications ownership backfill is blocked by current readiness evidence.");
  }

  const fingerprint = calculateCommunicationOwnershipPlanFingerprint(reviewed.plan);
  assertCommunicationApplyAuthorization({ args, environment, actualFingerprint: fingerprint });

  const session = await mongoose.startSession();
  let appliedCount = 0;
  try {
    await session.withTransaction(async () => {
      const current = await loadCommunicationOwnershipSnapshot({ configuration, session });
      const currentFingerprint = calculateCommunicationOwnershipPlanFingerprint(current.plan);

      if (!current.plan.executable || currentFingerprint !== fingerprint) {
        throw new Error(
          "Communications ownership state changed after plan review. Transaction aborted."
        );
      }

      for (const operation of current.plan.operations) {
        await applyOperation(operation, session);
        appliedCount += 1;
      }

      const postflight = await loadCommunicationOwnershipSnapshot({ configuration, session });
      if (!postflight.plan.executable || !postflight.plan.idempotentNoop) {
        throw new Error(
          "Communications postflight did not converge to an ownership-complete no-op. Transaction aborted."
        );
      }

      await writeMigrationAudit({
        session,
        snapshot: current,
        fingerprint,
        operationCount: appliedCount,
      });
    });
  } finally {
    await session.endSession();
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        appliedCount,
        reviewedFingerprint: fingerprint,
        postflightVerified: true,
        legacyGlobalUniqueIndexCutoverIncluded: false,
        identifiersIncluded: false,
        piiIncluded: false,
      },
      null,
      2
    )
  );
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Communications tenant backfill:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
