import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Appointment from "../src/models/Appointment.js";
import Customer from "../src/models/customer.js";
import {
  assertExplicitCanonicalTenantIdentity,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildCustomerAppointmentBackfillPlan,
} from "../src/platform/tenancy/customerAppointmentOwnershipMigration.js";
import {
  loadCustomerAppointmentOwnershipSnapshot,
} from "../src/platform/tenancy/customerAppointmentOwnershipSnapshot.js";
import {
  calculateCustomerAppointmentBackfillFingerprint,
} from "./planCustomerAppointmentTenantBackfill.js";

const APPLY_CONFIRMATION =
  "APPLY_CUSTOMER_APPOINTMENT_TENANT_BACKFILL";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI || environment.MONGO_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for Customer/Appointment tenant backfill."
    );
  }

  return uri;
}

export function assertCustomerAppointmentApplyAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  actualFingerprint,
} = {}) {
  if (!Array.isArray(args) || !args.includes("--apply")) {
    throw new Error(
      "Customer/Appointment tenant backfill requires the explicit --apply flag."
    );
  }

  if (
    String(
      environment.CUSTOMER_APPOINTMENT_TENANT_BACKFILL_CONFIRM || ""
    ).trim() !== APPLY_CONFIRMATION
  ) {
    throw new Error(
      `Customer/Appointment tenant backfill requires CUSTOMER_APPOINTMENT_TENANT_BACKFILL_CONFIRM=${APPLY_CONFIRMATION}.`
    );
  }

  const suppliedFingerprint = String(
    environment.CUSTOMER_APPOINTMENT_TENANT_BACKFILL_PLAN_FINGERPRINT || ""
  )
    .trim()
    .toLowerCase();
  const expectedFingerprint = String(actualFingerprint || "")
    .trim()
    .toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(suppliedFingerprint)) {
    throw new Error(
      "CUSTOMER_APPOINTMENT_TENANT_BACKFILL_PLAN_FINGERPRINT must contain the reviewed 64-character SHA-256 dry-run fingerprint."
    );
  }

  if (suppliedFingerprint !== expectedFingerprint) {
    throw new Error(
      "The reviewed Customer/Appointment backfill fingerprint does not match the current database plan. Re-run the dry-run plan and review the new evidence."
    );
  }

  assertExplicitCanonicalTenantIdentity(environment);
  return true;
}

async function loadCurrentPlan({ configuration, session = null } = {}) {
  const snapshot = await loadCustomerAppointmentOwnershipSnapshot({
    configuration,
    session,
    includeIndexes: false,
  });
  const plan = buildCustomerAppointmentBackfillPlan(
    snapshot.readiness
  );
  const fingerprint = calculateCustomerAppointmentBackfillFingerprint({
    readiness: snapshot.readiness,
    plan,
  });

  return {
    snapshot,
    plan,
    fingerprint,
  };
}

function assertSingleAppliedMutation(result, entityName) {
  if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
    throw new Error(
      `${entityName} ownership changed after plan review or the planned mutation was not applied. Transaction aborted; generate a new dry-run fingerprint.`
    );
  }
}

async function applyOperation({ operation, session }) {
  if (operation.type === "customer-update") {
    const result = await Customer.updateOne(
      {
        _id: operation.customerId,
        $or: [
          { business: { $exists: false } },
          { business: null },
        ],
      },
      {
        $set: operation.set,
      },
      { session }
    );

    assertSingleAppliedMutation(result, "Customer");
    return;
  }

  if (operation.type === "appointment-update") {
    const preconditions = {
      _id: operation.appointmentId,
    };

    if (Object.hasOwn(operation.set, "business")) {
      preconditions.$or = [
        { business: { $exists: false } },
        { business: null },
      ];
    }

    if (Object.hasOwn(operation.set, "location")) {
      preconditions.$and = [
        {
          $or: [
            { location: { $exists: false } },
            { location: null },
          ],
        },
      ];
    }

    const result = await Appointment.updateOne(
      preconditions,
      { $set: operation.set },
      { session }
    );

    assertSingleAppliedMutation(result, "Appointment");
    return;
  }

  throw new Error(
    `Unsupported Customer/Appointment backfill operation: ${operation.type}`
  );
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  const configuration = getCanonicalSalonTenantConfiguration(
    environment
  );

  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const reviewed = await loadCurrentPlan({ configuration });

  if (!reviewed.plan.executable) {
    throw new Error(
      "Customer/Appointment tenant backfill is blocked by current readiness evidence."
    );
  }

  assertCustomerAppointmentApplyAuthorization({
    args,
    environment,
    actualFingerprint: reviewed.fingerprint,
  });

  const session = await mongoose.startSession();
  let appliedOperations = 0;

  try {
    await session.withTransaction(async () => {
      const current = await loadCurrentPlan({
        configuration,
        session,
      });

      if (!current.plan.executable) {
        throw new Error(
          "Customer/Appointment readiness changed before apply. Transaction aborted."
        );
      }

      if (current.fingerprint !== reviewed.fingerprint) {
        throw new Error(
          "Customer/Appointment ownership state changed after plan review. Transaction aborted; generate a new dry-run fingerprint."
        );
      }

      for (const operation of current.plan.operations) {
        await applyOperation({ operation, session });
        appliedOperations += 1;
      }

      const postflight = await loadCustomerAppointmentOwnershipSnapshot({
        configuration,
        session,
        includeIndexes: false,
      });

      const remainingCustomerAssignments =
        postflight.readiness.summary.customerBusinessAssignments;
      const remainingAppointmentBusinessAssignments =
        postflight.readiness.summary.appointmentBusinessAssignments;
      const remainingAppointmentLocationAssignments =
        postflight.readiness.summary.appointmentLocationAssignments;

      if (
        remainingCustomerAssignments !== 0 ||
        remainingAppointmentBusinessAssignments !== 0 ||
        remainingAppointmentLocationAssignments !== 0 ||
        postflight.readiness.summary.blockers !== 0
      ) {
        throw new Error(
          "Customer/Appointment postflight verification failed. Transaction aborted."
        );
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        operationCount: appliedOperations,
        planFingerprint: reviewed.fingerprint,
        postflightVerified: true,
        identifiersIncluded: false,
        piiIncluded: false,
      },
      null,
      2
    )
  );
}

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error(
        "[FAIL] Customer/Appointment tenant backfill:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
