import assert from "node:assert/strict";
import test from "node:test";

import Customer from "../models/customer.js";
import {
  LEGACY_CUSTOMER_USER_ACCOUNT_INDEX,
  TARGET_CUSTOMER_USER_ACCOUNT_INDEX,
  buildCustomerUserAccountIndexReadiness,
  planCustomerUserAccountIndexMigration,
} from "../platform/data/customerUserAccountIndexMigration.js";
import {
  assertCustomerUserAccountIndexReadOnlyArguments,
  sanitiseCustomerUserAccountIndexReadiness,
} from "../../scripts/checkCustomerUserAccountIndexReadiness.js";
import {
  assertCustomerUserAccountIndexApplyAuthorization,
} from "../../scripts/applyCustomerUserAccountIndexMigration.js";

const FINGERPRINT = "a".repeat(64);

const legacyIndex = {
  name: LEGACY_CUSTOMER_USER_ACCOUNT_INDEX,
  key: { userAccount: 1 },
  unique: true,
  sparse: true,
};

const targetIndex = {
  name: TARGET_CUSTOMER_USER_ACCOUNT_INDEX,
  key: { userAccount: 1 },
  unique: true,
  partialFilterExpression: {
    userAccount: { $type: "objectId" },
  },
};

test("Customer userAccount readiness accepts the legacy state when linked accounts are unique", () => {
  const readiness = buildCustomerUserAccountIndexReadiness({
    indexes: [{ name: "_id_", key: { _id: 1 } }, legacyIndex],
    duplicateLinkedAccountGroups: 0,
  });

  assert.equal(readiness.safeForMigration, true);
  assert.equal(readiness.alreadyMigrated, false);
  assert.equal(readiness.summary.legacyIndexPresent, true);
  assert.equal(readiness.summary.targetIndexPresent, false);
});

test("Customer userAccount readiness fails closed for duplicate linked User ids", () => {
  const readiness = buildCustomerUserAccountIndexReadiness({
    indexes: [legacyIndex],
    duplicateLinkedAccountGroups: 2,
  });

  assert.equal(readiness.safeForMigration, false);
  assert.equal(
    readiness.blockers.some(
      (blocker) => blocker.blocker === "duplicate-linked-user-accounts"
    ),
    true
  );
});

test("Customer userAccount plan creates target before dropping legacy and is deterministic", () => {
  const input = {
    indexes: [legacyIndex],
    duplicateLinkedAccountGroups: 0,
  };

  const first = planCustomerUserAccountIndexMigration(input);
  const second = planCustomerUserAccountIndexMigration({
    ...input,
    indexes: [...input.indexes].reverse(),
  });

  assert.equal(first.writesPerformed, false);
  assert.equal(first.operationCount, 2);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(
    first.operations.map((operation) => operation.operation),
    [
      "create-target-partial-unique-index",
      "drop-legacy-sparse-unique-index",
    ]
  );
});

test("Customer userAccount readiness recognises the completed partial unique index", () => {
  const readiness = buildCustomerUserAccountIndexReadiness({
    indexes: [targetIndex],
    duplicateLinkedAccountGroups: 0,
  });

  assert.equal(readiness.safeForMigration, true);
  assert.equal(readiness.alreadyMigrated, true);
  assert.equal(readiness.summary.legacyIndexPresent, false);
  assert.equal(readiness.summary.targetIndexPresent, true);
});

test("Customer index readiness rejects write-like flags and sanitises output", () => {
  assert.equal(
    assertCustomerUserAccountIndexReadOnlyArguments([]),
    true
  );

  for (const argument of [
    "--apply",
    "--write=true",
    "--migrate",
    "--drop=userAccount_1",
  ]) {
    assert.throws(
      () =>
        assertCustomerUserAccountIndexReadOnlyArguments([argument]),
      /read-only/
    );
  }

  const sanitised = sanitiseCustomerUserAccountIndexReadiness(
    buildCustomerUserAccountIndexReadiness({
      indexes: [legacyIndex],
      duplicateLinkedAccountGroups: 0,
    })
  );

  assert.equal(sanitised.databaseWrites, false);
  assert.equal(sanitised.customerIdentifiersIncluded, false);
});

test("Customer index apply gate requires explicit flag, confirmation and reviewed fingerprint", () => {
  assert.throws(
    () =>
      assertCustomerUserAccountIndexApplyAuthorization({
        args: [],
        environment: {},
        actualFingerprint: FINGERPRINT,
      }),
    /--apply/
  );

  assert.throws(
    () =>
      assertCustomerUserAccountIndexApplyAuthorization({
        args: ["--apply"],
        environment: {},
        actualFingerprint: FINGERPRINT,
      }),
    /CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_CONFIRM/
  );

  assert.throws(
    () =>
      assertCustomerUserAccountIndexApplyAuthorization({
        args: ["--apply"],
        environment: {
          CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_CONFIRM:
            "APPLY_CUSTOMER_USER_ACCOUNT_PARTIAL_INDEX",
          CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_PLAN_FINGERPRINT:
            "short",
        },
        actualFingerprint: FINGERPRINT,
      }),
    /64-character/
  );

  assert.throws(
    () =>
      assertCustomerUserAccountIndexApplyAuthorization({
        args: ["--apply"],
        environment: {
          CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_CONFIRM:
            "APPLY_CUSTOMER_USER_ACCOUNT_PARTIAL_INDEX",
          CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_PLAN_FINGERPRINT:
            "b".repeat(64),
        },
        actualFingerprint: FINGERPRINT,
      }),
    /does not match/
  );
});

test("Customer schema declares an ObjectId-only partial unique userAccount index", () => {
  const userAccountPath = Customer.schema.path("userAccount");

  assert.equal(userAccountPath.options.unique, undefined);
  assert.equal(userAccountPath.options.sparse, undefined);

  const declaredIndex = Customer.schema
    .indexes()
    .find(([, options]) => options?.name === TARGET_CUSTOMER_USER_ACCOUNT_INDEX);

  assert.ok(declaredIndex, "Expected Customer userAccount partial unique index");

  const [keys, options] = declaredIndex;
  assert.deepEqual(keys, { userAccount: 1 });
  assert.equal(options.unique, true);
  assert.equal(
    options.partialFilterExpression?.userAccount?.$type,
    "objectId"
  );
});
