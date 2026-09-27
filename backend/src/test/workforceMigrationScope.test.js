import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  assertCanonicalWorkforceMigrationScope,
  buildCanonicalWorkforceMigrationScope,
} from "../platform/tenancy/workforceMigrationScope.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

test("workforce migration scope is proven only when canonical Business is the sole Business", () => {
  const businessId =
    oid();

  const scope =
    buildCanonicalWorkforceMigrationScope({
      businessId,
      businesses: [
        {
          _id:
            businessId,
        },
      ],
    });

  assert.equal(
    scope.safeForGlobalUnownedBackfill,
    true
  );
  assert.equal(
    scope.businessCount,
    1
  );
  assert.equal(
    assertCanonicalWorkforceMigrationScope(
      scope
    ),
    true
  );
});

test("workforce migration scope blocks a second Business", () => {
  const businessId =
    oid();

  const scope =
    buildCanonicalWorkforceMigrationScope({
      businessId,
      businesses: [
        {
          _id:
            businessId,
        },
        {
          _id:
            oid(),
        },
      ],
    });

  assert.equal(
    scope.safeForGlobalUnownedBackfill,
    false
  );
  assert.ok(
    scope.blockers.includes(
      "additional-business-present"
    )
  );
  assert.throws(
    () =>
      assertCanonicalWorkforceMigrationScope(
        scope
      ),
    (error) =>
      error.code ===
      "WORKFORCE_MIGRATION_SCOPE_NOT_PROVEN"
  );
});

test("workforce migration scope blocks missing canonical Business identity", () => {
  const businessId =
    oid();

  const scope =
    buildCanonicalWorkforceMigrationScope({
      businessId,
      businesses: [
        {
          _id:
            oid(),
        },
      ],
    });

  assert.equal(
    scope.safeForGlobalUnownedBackfill,
    false
  );
  assert.ok(
    scope.blockers.includes(
      "canonical-business-count-not-one"
    )
  );
});
