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
  "order management permissions are canonical allowed-location permissions",
  () => {
    for (const permission of [
      "order:read",
      "order:update",
      "order:refund",
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
  "commerce management routes do not use legacy management role gates",
  async () => {
    const routes = await source(
      "../features/commerce/commerceRoutes.js"
    );

    assert.doesNotMatch(
      routes,
      /managementOnly|adminOnly|authorize\(/
    );

    assert.match(
      routes,
      /"\/orders"[\s\S]{0,160}requirePermissions\(\s*"order:read"\s*\)/
    );
    assert.match(
      routes,
      /"\/orders\/:id\/status"[\s\S]{0,160}requirePermissions\(\s*"order:update"\s*\)/
    );
    assert.match(
      routes,
      /"\/orders\/:id\/refunds"[\s\S]{0,160}requirePermissions\(\s*"order:refund"\s*\)/
    );
  }
);

test(
  "customer order routes remain self-service protected flows",
  async () => {
    const routes = await source(
      "../features/commerce/commerceRoutes.js"
    );

    assert.match(
      routes,
      /"\/orders\/mine"[\s\S]{0,120}protect[\s\S]{0,120}listMyOrders/
    );
    assert.match(
      routes,
      /"\/orders\/:id"[\s\S]{0,120}protect[\s\S]{0,120}getOrder/
    );
    assert.match(
      routes,
      /"\/orders\/:id\/cancel"[\s\S]{0,120}protect[\s\S]{0,120}cancelOrder/
    );
  }
);

test(
  "order management frontend uses canonical read and update permissions",
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
    const permissions = await source(
      "../../../frontend/src/utils/permissions.js"
    );

    assert.match(
      app,
      /path="manage\/orders"[\s\S]*permissionPage\(OrderManagement,\s*"order:read"\)/
    );
    assert.match(
      navigation,
      /\/manage\/orders[^\n]*order:read/
    );
    assert.match(
      page,
      /hasPermission\(user,\s*"order:update"\)/
    );
    assert.match(
      permissions,
      /order:refund/
    );
  }
);
