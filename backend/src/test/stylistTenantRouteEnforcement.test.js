import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  EMPLOYEE_PERMISSION_SET,
  NON_DELEGABLE_EMPLOYEE_PERMISSIONS,
  STAFF_ROLE_BASELINE_PERMISSIONS,
} from "../constants/permissions.js";
import {
  permissionScope,
} from "../services/permissionScopeService.js";

test(
  "stylist routes compose trusted host, membership and effective authority",
  async () => {
    const source =
      await readFile(
        new URL(
          "../routes/stylistRoutes.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /workforcePublicTenantContextMiddleware/
    );
    assert.match(
      source,
      /trustedTenantContextMiddleware/
    );
    assert.match(
      source,
      /effectiveAuthorityMiddleware/
    );
    assert.match(
      source,
      /const protectedWorkforceTenantChain = \[\s*protect,\s*workforcePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*\];/
    );

    for (
      const permission of [
        "profile:all:read",
        "profile:own:read",
        "profile:own:update",
        "employee:create",
        "profile:all:update",
        "employee:delete",
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          permission.replace(
            ":",
            "\\:"
          )
        )
      );
    }

    assert.doesNotMatch(
      source,
      /superAdminOnly/
    );
  }
);

test(
  "public workforce routes resolve Business from trusted host context",
  async () => {
    const source =
      await readFile(
        new URL(
          "../routes/stylistRoutes.js",
          import.meta.url
        ),
        "utf8"
      );

    for (
      const route of [
        '"/public"',
        '"/booking"',
        '"/:id/availability"',
      ]
    ) {
      const index =
        source.indexOf(
          route
        );

      assert.notEqual(
        index,
        -1
      );

      assert.match(
        source.slice(
          index,
          index + 350
        ),
        /workforcePublicTenantContextMiddleware/
      );
    }
  }
);

test(
  "stylist controller scopes public and management database access",
  async () => {
    const source =
      await readFile(
        new URL(
          "../controllers/stylistController.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /publicWorkforceBusinessId\(/
    );
    assert.match(
      source,
      /scopedWorkforceFilter\(/
    );
    assert.match(
      source,
      /workforceCreationOwnership\(/
    );

    assert.doesNotMatch(
      source,
      /Stylist\.findByIdAndUpdate\(/
    );
    assert.doesNotMatch(
      source,
      /Stylist\.findByIdAndDelete\(/
    );

    assert.match(
      source,
      /delete payload\.business;/
    );
    assert.match(
      source,
      /delete payload\.workingLocations;/
    );
    assert.match(
      source,
      /delete payload\.userAccount;/
    );
  }
);

test(
  "hard employee deletion is canonical, business-scoped and non-delegable",
  () => {
    assert.equal(
      EMPLOYEE_PERMISSION_SET.has(
        "employee:delete"
      ),
      true
    );
    assert.equal(
      permissionScope(
        "employee:delete"
      ),
      "B"
    );
    assert.equal(
      NON_DELEGABLE_EMPLOYEE_PERMISSIONS.includes(
        "employee:delete"
      ),
      true
    );
    assert.equal(
      STAFF_ROLE_BASELINE_PERMISSIONS
        .super_admin
        .includes(
          "employee:delete"
        ),
      true
    );

    for (
      const role of [
        "admin",
        "receptionist",
        "manager",
        "stylist",
      ]
    ) {
      assert.equal(
        (
          STAFF_ROLE_BASELINE_PERMISSIONS[
            role
          ] || []
        ).includes(
          "employee:delete"
        ),
        false
      );
    }
  }
);
