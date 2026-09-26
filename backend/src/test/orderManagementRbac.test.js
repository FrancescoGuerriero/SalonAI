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
  "order management permissions are canonical and scoped to allowed locations",
  () => {
    for (const permission of [
      "order:read",
      "order:manage",
      "order:refund",
    ]) {
      assert.ok(
        EMPLOYEE_PERMISSIONS.includes(permission)
      );
      assert.ok(
        STAFF_ROLE_BASELINE_PERMISSIONS.admin.includes(permission)
      );
      assert.equal(
        permissionScope(permission),
        "A"
      );
    }
  }
);

test(
  "commerce management routes use explicit order permissions instead of managementOnly",
  async () => {
    const routes = await source(
      "../features/commerce/commerceRoutes.js"
    );

    assert.doesNotMatch(
      routes,
      /managementOnly/
    );

    assert.match(
      routes,
      /"\/orders"[\s\S]{0,180}requirePermissions\(\s*"order:read"\s*\)/
    );
    assert.match(
      routes,
      /"\/orders\/:id\/status"[\s\S]{0,180}requirePermissions\(\s*"order:manage"\s*\)/
    );
    assert.match(
      routes,
      /"\/orders\/:id\/refunds"[\s\S]{0,180}requirePermissions\(\s*"order:refund"\s*\)/
    );

    assert.match(
      routes,
      /"\/orders\/mine"[\s\S]{0,120}protect[\s\S]{0,120}listMyOrders/
    );
    assert.match(
      routes,
      /"\/orders\/:id\/cancel"[\s\S]{0,120}protect[\s\S]{0,120}cancelOrder/
    );
  }
);

test(
  "order management frontend uses order permissions consistently",
  async () => {
    const app = await source(
      "../../../frontend/src/App.jsx"
    );
    const navigation = await source(
      "../../../frontend/src/components/navigation/managementNavigationConfig.js"
    );
    const page = await source(
      "../../../frontend/src/pages/OrderManagement.jsx"
    );
    const frontendPermissions = await source(
      "../../../frontend/src/utils/permissions.js"
    );

    assert.match(
      app,
      /path="manage\/orders"[\s\S]{0,160}permissionPage\(OrderManagement,\s*"order:read"\)/
    );
    assert.match(
      navigation,
      /\/manage\/orders[^\n]*order:read/
    );
    assert.doesNotMatch(
      navigation,
      /\/manage\/orders[^\n]*product:read/
    );

    assert.match(
      page,
      /hasPermission\(user,\s*"order:manage"\)/
    );
    assert.match(
      page,
      /disabled=\{!canManage\}/
    );
    assert.doesNotMatch(
      page,
      /\["admin",\s*"manager"\]\.includes/
    );

    for (const permission of [
      "order:read",
      "order:manage",
      "order:refund",
    ]) {
      assert.match(
        frontendPermissions,
        new RegExp(permission.replace(":", "\\:"))
      );
    }
  }
);
