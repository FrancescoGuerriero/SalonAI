import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "purchase order creation route requires inventory manage",
  async () => {
    const app = await source(
      "../../../frontend/src/App.jsx"
    );

    assert.match(
      app,
      /path="purchase-orders\/new"[\s\S]{0,220}permissionPage\(CreatePurchaseOrderPage,\s*"inventory:manage"\)/
    );

    assert.match(
      app,
      /path="purchase-orders"[\s\S]{0,220}permissionPage\(PurchaseOrdersPage,\s*"inventory:read"\)/
    );

    assert.match(
      app,
      /path="purchase-orders\/:purchaseOrderId"[\s\S]{0,220}permissionPage\(PurchaseOrderDetailsPage,\s*"inventory:read"\)/
    );
  }
);

test(
  "supplier management gates writes with inventory manage",
  async () => {
    const page = await source(
      "../../../frontend/src/pages/SupplierManagementPage.jsx"
    );

    assert.match(
      page,
      /hasPermission\(user,\s*"inventory:manage"\)/
    );
    assert.match(
      page,
      /disabled=\{!canManage\}/
    );
    assert.match(
      page,
      /if \(!canManage\) return;/
    );
  }
);

test(
  "purchase order list and detail mutation controls use inventory manage",
  async () => {
    const list = await source(
      "../../../frontend/src/pages/PurchaseOrdersPage.jsx"
    );
    const details = await source(
      "../../../frontend/src/pages/PurchaseOrderDetailsPage.jsx"
    );

    assert.match(
      list,
      /hasPermission\(user,\s*"inventory:manage"\)/
    );
    assert.match(
      list,
      /canManage \? \([\s\S]{0,220}href="\/purchase-orders\/new"/
    );

    assert.match(
      details,
      /hasPermission\(user,\s*"inventory:manage"\)/
    );
    assert.match(
      details,
      /disabled=\{!canManage\}/
    );
    assert.match(
      details,
      /Read-only access\. Inventory management permission is required/
    );
  }
);
