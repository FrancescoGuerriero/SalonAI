import assert from "node:assert/strict";
import test from "node:test";

import Product from "../features/commerce/Product.js";
import Supplier from "../features/inventoryPurchasing/models/Supplier.js";
import SupplierProduct from "../features/inventoryPurchasing/models/SupplierProduct.js";
import PurchaseOrder from "../features/inventoryPurchasing/models/PurchaseOrder.js";
import {
  assertInventoryResourceWithinScope,
  inventoryBusinessFilter,
  inventoryLocationFilter,
  stripInventoryOwnershipInput,
} from "../features/inventoryPurchasing/services/ownershipScope.js";
import {
  buildInventoryPurchasingOwnershipPlan,
  calculateInventoryPurchasingPlanFingerprint,
} from "../platform/tenancy/inventoryPurchasingOwnershipMigration.js";
import {
  assertInventoryPurchasingApplyAuthorization,
  INVENTORY_PURCHASING_BACKFILL_CONFIRMATION,
} from "../../scripts/applyInventoryPurchasingTenantBackfill.js";

test("inventory purchasing models expose transitional Business/Location ownership", () => {
  for (const Model of [Product, Supplier, SupplierProduct, PurchaseOrder]) {
    assert.ok(Model.schema.path("business"));
    assert.ok(Model.schema.path("location"));
  }
});

test("inventory domain declares tenant-local uniqueness indexes", () => {
  const supplierIndex = Supplier.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.code === 1 && options.unique
  );
  const orderIndex = PurchaseOrder.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.orderNumber === 1 && options.unique
  );
  const productSlugIndex = Product.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.slug === 1 && options.unique
  );
  const productSkuIndex = Product.schema.indexes().find(
    ([fields, options]) => fields.business === 1 && fields.sku === 1 && options.unique
  );
  assert.ok(supplierIndex);
  assert.ok(orderIndex);
  assert.ok(productSlugIndex);
  assert.ok(productSkuIndex);
});

test("unowned canonical single-location records produce deterministic ownership operations", () => {
  const input = {
    business: { _id: "507f1f77bcf86cd799439011" },
    location: { _id: "507f1f77bcf86cd799439012" },
    products: [
      {
        _id: "507f1f77bcf86cd799439020",
        slug: "shampoo",
        sku: "SKU-1",
      },
    ],
    suppliers: [
      { _id: "507f1f77bcf86cd799439021", code: "DAV" },
    ],
    supplierProducts: [
      {
        _id: "507f1f77bcf86cd799439031",
        supplier: "507f1f77bcf86cd799439021",
        product: "507f1f77bcf86cd799439020",
      },
    ],
    purchaseOrders: [
      {
        _id: "507f1f77bcf86cd799439041",
        supplier: "507f1f77bcf86cd799439021",
        orderNumber: "PO-1",
      },
    ],
  };

  const first = buildInventoryPurchasingOwnershipPlan(input);
  const second = buildInventoryPurchasingOwnershipPlan(input);

  assert.equal(first.executable, true);
  assert.equal(first.summary.operationCount, 4);
  assert.equal(first.coverage.products.missingLocation, 1);
  assert.equal(first.coverage.purchaseOrders.missingLocation, 1);
  assert.equal(
    calculateInventoryPurchasingPlanFingerprint(first),
    calculateInventoryPurchasingPlanFingerprint(second)
  );
});

test("foreign tenant/location ownership fails closed", () => {
  const plan = buildInventoryPurchasingOwnershipPlan({
    business: { _id: "507f1f77bcf86cd799439011" },
    location: { _id: "507f1f77bcf86cd799439012" },
    products: [
      {
        _id: "507f1f77bcf86cd799439020",
        business: "507f1f77bcf86cd799439011",
        location: "507f1f77bcf86cd799439098",
        slug: "shampoo",
        sku: "SKU-1",
      },
    ],
    suppliers: [
      {
        _id: "507f1f77bcf86cd799439021",
        business: "507f1f77bcf86cd799439099",
        code: "DAV",
      },
    ],
    purchaseOrders: [
      {
        _id: "507f1f77bcf86cd799439041",
        business: "507f1f77bcf86cd799439011",
        location: "507f1f77bcf86cd799439098",
        supplier: "507f1f77bcf86cd799439021",
        orderNumber: "PO-1",
      },
    ],
  });

  assert.equal(plan.executable, false);
  assert.ok(plan.blockers.some((item) => item.type === "foreign-business-ownership"));
  assert.ok(plan.blockers.some((item) => item.type === "foreign-location-ownership"));
});

test("inventory scope helpers use only trusted tenant context", () => {
  const context = {
    businessId: "507f1f77bcf86cd799439011",
    locationId: "507f1f77bcf86cd799439012",
  };

  assert.deepEqual(inventoryBusinessFilter(context), {
    business: context.businessId,
  });
  assert.deepEqual(inventoryLocationFilter(context), {
    business: context.businessId,
    location: context.locationId,
  });
  assert.equal(
    assertInventoryResourceWithinScope(
      { business: context.businessId, location: context.locationId },
      context,
      { requireLocation: true }
    ),
    true
  );
  assert.deepEqual(
    stripInventoryOwnershipInput({
      name: "Supplier",
      business: "attacker-business",
      businessId: "attacker-business",
      location: "attacker-location",
      locationId: "attacker-location",
      tenantId: "attacker-tenant",
    }),
    { name: "Supplier" }
  );
});

test("guarded apply requires exact confirmation and reviewed fingerprint", () => {
  const fingerprint = "a".repeat(64);
  assert.throws(() =>
    assertInventoryPurchasingApplyAuthorization({
      args: [],
      environment: {},
      actualFingerprint: fingerprint,
    })
  );

  assert.throws(() =>
    assertInventoryPurchasingApplyAuthorization({
      args: ["--apply"],
      environment: {
        INVENTORY_PURCHASING_TENANT_BACKFILL_CONFIRM:
          INVENTORY_PURCHASING_BACKFILL_CONFIRMATION,
        INVENTORY_PURCHASING_TENANT_BACKFILL_PLAN_FINGERPRINT: "b".repeat(64),
      },
      actualFingerprint: fingerprint,
    })
  );
});
