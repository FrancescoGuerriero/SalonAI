import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EMPLOYEE_PERMISSIONS,
  STAFF_ROLE_BASELINE_PERMISSIONS,
} from "../constants/permissions.js";
import {
  permissionScope,
} from "../services/permissionScopeService.js";

async function source(
  relativePath
) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test(
  "security audit access is an explicit business-scoped permission",
  () => {
    assert.ok(
      EMPLOYEE_PERMISSIONS.includes(
        "security:audit:read"
      )
    );
    assert.ok(
      STAFF_ROLE_BASELINE_PERMISSIONS.admin.includes(
        "security:audit:read"
      )
    );
    assert.equal(
      permissionScope(
        "security:audit:read"
      ),
      "B"
    );
  }
);

test(
  "future security router no longer uses blanket management or admin role gates",
  async () => {
    const parent =
      await source(
        "../features/futureFeatureRoutes.js"
      );
    const routes =
      await source(
        "../features/security/securityRoutes.js"
      );

    const securityMount =
      parent.slice(
        parent.indexOf(
          '"/security"'
        ) - 80,
        parent.indexOf(
          '"/security"'
        ) + 160
      );

    assert.doesNotMatch(
      securityMount,
      /managementOnly|adminOnly|superAdminOnly/
    );
    assert.doesNotMatch(
      routes,
      /managementOnly|adminOnly|superAdminOnly/
    );
    assert.match(
      routes,
      /"\/audit-logs"[\s\S]*requirePermissions\(\s*"security:audit:read"\s*\)/
    );
    assert.match(
      routes,
      /"\/permissions"[\s\S]*requirePermissions\(\s*"staff-role:read"\s*\)/
    );
  }
);

test(
  "security permission inspection consumes the canonical StaffRole registry instead of a duplicate matrix",
  async () => {
    const service =
      await source(
        "../features/security/securityService.js"
      );
    const controller =
      await source(
        "../features/security/securityController.js"
      );
    const frontendPermissions =
      await source(
        "../../../frontend/src/utils/permissions.js"
      );

    assert.match(
      service,
      /listStaffRoleDefinitions/
    );
    assert.match(
      service,
      /canonical_staff_role_registry/
    );
    assert.doesNotMatch(
      service,
      /manage_customers|view_calendar|update_appointment_status/
    );
    assert.match(
      controller,
      /await service\.permissionMatrix\(\)/
    );
    assert.match(
      frontendPermissions,
      /security:audit:read/
    );
    assert.match(
      frontendPermissions,
      /View security audit logs/
    );
  }
);
