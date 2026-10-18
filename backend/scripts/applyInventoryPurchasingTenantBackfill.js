import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import AuditLog from "../src/models/AuditLog.js";
import Product from "../src/features/commerce/Product.js";
import Supplier from "../src/features/inventoryPurchasing/models/Supplier.js";
import SupplierProduct from "../src/features/inventoryPurchasing/models/SupplierProduct.js";
import PurchaseOrder from "../src/features/inventoryPurchasing/models/PurchaseOrder.js";
import {
  assertExplicitCanonicalTenantIdentity,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  loadInventoryPurchasingOwnershipSnapshot,
} from "../src/platform/tenancy/inventoryPurchasingOwnershipSnapshot.js";
import {
  calculateInventoryPurchasingPlanFingerprint,
} from "../src/platform/tenancy/inventoryPurchasingOwnershipMigration.js";

export const INVENTORY_PURCHASING_BACKFILL_CONFIRMATION =
  "APPLY_INVENTORY_PURCHASING_TENANT_BACKFILL";

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required for inventory/purchasing tenant backfill.");
  return uri;
}

export function assertInventoryPurchasingApplyAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  actualFingerprint,
} = {}) {
  if (!Array.isArray(args) || !args.includes("--apply")) {
    throw new Error("Inventory/purchasing tenant backfill requires explicit --apply.");
  }

  if (
    String(environment.INVENTORY_PURCHASING_TENANT_BACKFILL_CONFIRM || "").trim() !==
    INVENTORY_PURCHASING_BACKFILL_CONFIRMATION
  ) {
    throw new Error(
      `Inventory/purchasing tenant backfill requires INVENTORY_PURCHASING_TENANT_BACKFILL_CONFIRM=${INVENTORY_PURCHASING_BACKFILL_CONFIRMATION}.`
    );
  }

  const supplied = String(
    environment.INVENTORY_PURCHASING_TENANT_BACKFILL_PLAN_FINGERPRINT || ""
  )
    .trim()
    .toLowerCase();
  const expected = String(actualFingerprint || "").trim().toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(supplied)) {
    throw new Error(
      "INVENTORY_PURCHASING_TENANT_BACKFILL_PLAN_FINGERPRINT must contain the reviewed 64-character SHA-256 plan fingerprint."
    );
  }
  if (supplied !== expected) {
    throw new Error(
      "The reviewed inventory/purchasing backfill fingerprint no longer matches current database state. Generate and review a new dry-run plan."
    );
  }

  assertExplicitCanonicalTenantIdentity(environment);
  return true;
}

function missing(field) {
  return { $or: [{ [field]: { $exists: false } }, { [field]: null }] };
}

async function applyOperation(operation, session) {
  let Model;
  if (operation.recordType === "Product") Model = Product;
  if (operation.recordType === "Supplier") Model = Supplier;
  if (operation.recordType === "SupplierProduct") Model = SupplierProduct;
  if (operation.recordType === "PurchaseOrder") Model = PurchaseOrder;
  if (!Model) throw new Error(`Unsupported inventory migration record type: ${operation.recordType}`);

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
        action: "tenant_migration.inventory_purchasing_business_location_backfill",
        resourceType: "TenantMigration",
        resourceId: fingerprint,
        before: snapshot.plan.coverage,
        after: {
          products: {
            unownedBusiness: 0,
            foreignBusiness: 0,
            missingLocation: 0,
            foreignLocation: 0,
          },
          suppliers: { unownedBusiness: 0, foreignBusiness: 0 },
          supplierProducts: { unownedBusiness: 0, foreignBusiness: 0 },
          purchaseOrders: {
            unownedBusiness: 0,
            foreignBusiness: 0,
            missingLocation: 0,
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

  const reviewed = await loadInventoryPurchasingOwnershipSnapshot({ configuration });
  if (!reviewed.plan.executable) {
    throw new Error("Inventory/purchasing ownership backfill is blocked by current readiness evidence.");
  }
  const fingerprint = calculateInventoryPurchasingPlanFingerprint(reviewed.plan);
  assertInventoryPurchasingApplyAuthorization({ args, environment, actualFingerprint: fingerprint });

  const session = await mongoose.startSession();
  let appliedCount = 0;
  try {
    await session.withTransaction(async () => {
      const current = await loadInventoryPurchasingOwnershipSnapshot({ configuration, session });
      const currentFingerprint = calculateInventoryPurchasingPlanFingerprint(current.plan);

      if (!current.plan.executable || currentFingerprint !== fingerprint) {
        throw new Error(
          "Inventory/purchasing ownership state changed after plan review. Transaction aborted."
        );
      }

      for (const operation of current.plan.operations) {
        await applyOperation(operation, session);
        appliedCount += 1;
      }

      const postflight = await loadInventoryPurchasingOwnershipSnapshot({ configuration, session });
      if (!postflight.plan.executable || !postflight.plan.idempotentNoop) {
        throw new Error(
          "Inventory/purchasing postflight did not converge to an ownership-complete no-op. Transaction aborted."
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
      console.error("[FAIL] Inventory/purchasing tenant backfill:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
