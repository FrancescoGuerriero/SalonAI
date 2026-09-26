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

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "customer experience permissions are canonical allowed-location permissions",
  () => {
    for (const permission of [
      "customer-experience:read",
      "customer-experience:manage",
    ]) {
      assert.ok(
        EMPLOYEE_PERMISSIONS.includes(permission)
      );
      assert.equal(
        permissionScope(permission),
        "A"
      );
      assert.ok(
        STAFF_ROLE_BASELINE_PERMISSIONS.admin.includes(permission)
      );
    }
  }
);

test(
  "customer experience management routes use read and manage permissions instead of role gates",
  async () => {
    const routes = await source(
      "../features/customerExperience/customerExperienceRoutes.js"
    );

    assert.doesNotMatch(
      routes,
      /managementOnly|adminOnly|superAdminOnly|authorize\(/
    );

    for (const readRoute of [
      "\/management\/offers",
      "\/management\/appointment-requests",
      "\/management\/overview",
    ]) {
      assert.match(
        routes,
        new RegExp(
          `router\\.get\\("${readRoute}"[\\s\\S]{0,140}requirePermissions\\("customer-experience:read"\\)`
        )
      );
    }

    for (const writeRoute of [
      "router\\.post\\(\"\\/management\\/offers\"",
      "router\\.patch\\(\"\\/management\\/offers\\/:offerId\"",
      "router\\.patch\\(\"\\/management\\/appointment-requests\\/:requestId\"",
      "router\\.patch\\(\"\\/management\\/reviews\\/:reviewId\"",
      "router\\.patch\\(\"\\/management\\/feedback\\/:feedbackId\"",
      "router\\.patch\\(\"\\/management\\/consultations\\/:consultationId\"",
    ]) {
      assert.match(
        routes,
        new RegExp(
          `${writeRoute}[\\s\\S]{0,140}requirePermissions\\("customer-experience:manage"\\)`
        )
      );
    }

    assert.match(
      routes,
      /router\.get\("\/me",\s*asyncHandler\(controller\.getCustomerExperience\)\)/
    );
    assert.match(
      routes,
      /router\.post\("\/me\/reviews",\s*requireFeature\("reviews"\)/
    );
  }
);

test(
  "customer experience frontend uses read permission and gates mutation controls with manage permission",
  async () => {
    const app = await source(
      "../../../frontend/src/App.jsx"
    );
    const navigation = await source(
      "../../../frontend/src/components/navigation/managementNavigationConfig.js"
    );
    const page = await source(
      "../../../frontend/src/pages/CustomerExperienceManagementPage.jsx"
    );
    const permissions = await source(
      "../../../frontend/src/utils/permissions.js"
    );

    assert.match(
      app,
      /customer-experience-management"[\s\S]{0,180}permissionPage\(CustomerExperienceManagementPage,\s*"customer-experience:read"\)/
    );
    assert.match(
      navigation,
      /\/customer-experience-management[^\n]*customer-experience:read/
    );
    assert.match(
      page,
      /hasPermission\(user,\s*"customer-experience:manage"\)/
    );
    assert.match(
      page,
      /disabled=\{!canManage \|\| busy\}/
    );
    assert.match(
      permissions,
      /customer-experience:manage/
    );
  }
);
