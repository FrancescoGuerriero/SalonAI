import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test("supplier and purchase-order routes separate inventory read and management authority", async () => {
  const supplier =
    await source(
      "../features/inventoryPurchasing/routes/supplierRoutes.js"
    );
  const purchaseOrder =
    await source(
      "../features/inventoryPurchasing/routes/purchaseOrderRoutes.js"
    );

  for (const routes of [
    supplier,
    purchaseOrder,
  ]) {
    assert.match(
      routes,
      /requireAnyPermission\(\s*"inventory:read",\s*"inventory:manage"\s*\)/
    );
    assert.match(
      routes,
      /requirePermissions\(\s*"inventory:manage"\s*\)/
    );
  }

  assert.match(
    supplier,
    /\.get\(\s*readInventory,[\s\S]*?listSuppliers/s
  );
  assert.match(
    supplier,
    /\.post\(\s*manageInventory,[\s\S]*?createSupplier/s
  );

  assert.match(
    purchaseOrder,
    /\.get\(\s*readInventory,[\s\S]*?listPurchaseOrders/s
  );
  assert.match(
    purchaseOrder,
    /"\/:purchaseOrderId\/approve",\s*manageInventory/s
  );
  assert.match(
    purchaseOrder,
    /"\/:purchaseOrderId\/receive",\s*manageInventory/s
  );
});

test("reorder and supplier analytics require inventory read authority", async () => {
  const routes =
    await source(
      "../features/inventoryPurchasing/routes/inventoryPurchasingRoutes.js"
    );

  assert.match(
    routes,
    /"\/reorder-recommendations",\s*readInventory/s
  );
  assert.match(
    routes,
    /"\/supplier-performance",\s*readInventory/s
  );
});

test("core inventory mutations require inventory management authority", async () => {
  const routes =
    await source(
      "../features/inventory/inventoryRoutes.js"
    );

  assert.match(
    routes,
    /router\.get\(\s*"\/",\s*readInventory/s
  );
  assert.match(
    routes,
    /router\.post\(\s*"\/",\s*manageInventory/s
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/:itemId",\s*manageInventory/s
  );
  assert.match(
    routes,
    /router\.delete\(\s*"\/:itemId",\s*manageInventory/s
  );
});
