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
  "privacy request management is an explicit business-scoped permission",
  () => {
    assert.ok(
      EMPLOYEE_PERMISSIONS.includes(
        "privacy-request:manage"
      )
    );

    assert.ok(
      STAFF_ROLE_BASELINE_PERMISSIONS.admin.includes(
        "privacy-request:manage"
      )
    );

    assert.equal(
      permissionScope(
        "privacy-request:manage"
      ),
      "B"
    );
  }
);

test(
  "privacy management routes use canonical permission checks instead of built-in role gates",
  async () => {
    const routes =
      await source(
        "../routes/privacyRequestRoutes.js"
      );

    assert.doesNotMatch(
      routes,
      /adminOnly|managementOnly|superAdminOnly/
    );

    assert.match(
      routes,
      /"\/management"[\s\S]*requirePermissions\(\s*"privacy-request:manage"\s*\)/
    );

    assert.match(
      routes,
      /"\/management\/:id"[\s\S]*requirePermissions\(\s*"privacy-request:manage"\s*\)/
    );
  }
);

test(
  "privacy management frontend route and navigation use the same canonical permission",
  async () => {
    const app =
      await source(
        "../../../frontend/src/App.jsx"
      );
    const navigation =
      await source(
        "../../../frontend/src/components/navigation/managementNavigationConfig.js"
      );
    const frontendPermissions =
      await source(
        "../../../frontend/src/utils/permissions.js"
      );

    assert.match(
      app,
      /path="admin\/privacy-requests"[\s\S]*permissionPage\([\s\S]*AdminPrivacyRequestsPage,[\s\S]*"privacy-request:manage"/
    );

    assert.match(
      navigation,
      /\/admin\/privacy-requests[\s\S]*privacy-request:manage/
    );

    assert.doesNotMatch(
      navigation,
      /\/admin\/privacy-requests[^\n]*customer:read/
    );

    assert.match(
      frontendPermissions,
      /privacy-request:manage/
    );
    assert.match(
      frontendPermissions,
      /Manage privacy-rights requests/
    );
  }
);
