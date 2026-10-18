import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Product from "../features/commerce/Product.js";
import Supplier from "../features/inventoryPurchasing/models/Supplier.js";
import SupplierProduct from "../features/inventoryPurchasing/models/SupplierProduct.js";
import PurchaseOrder from "../features/inventoryPurchasing/models/PurchaseOrder.js";
import {
  assertInventoryResourceWithinScope,
  inventoryBusinessFilter,
  inventoryLocationFilter,
  resolveInventoryAuthority,
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

const businessA = "507f1f77bcf86cd799439011";
const locationA = "507f1f77bcf86cd799439012";
const locationB = "507f1f77bcf86cd799439013";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

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
    business: { _id: businessA },
    location: { _id: locationA },
    products: [
      {
        _id: "507f1f77bcf86cd799439020",
        slug: "shampoo",
        sku: "SKU-1",
      },
    ],
    suppliers: [{ _id: "507f1f77bcf86cd799439021", code: "DAV" }],
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
    business: { _id: businessA },
    location: { _id: locationA },
    products: [
      {
        _id: "507f1f77bcf86cd799439020",
        business: businessA,
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
        business: businessA,
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

test("inventory scope helpers use trusted selected-location authority", () => {
  const authority = {
    businessId: businessA,
    locationId: locationA,
    locationAccessMode: "selected",
    allowedLocationIds: [locationA],
  };

  assert.deepEqual(inventoryBusinessFilter(authority), { business: businessA });
  assert.deepEqual(inventoryLocationFilter(authority), {
    business: businessA,
    location: locationA,
  });
  assert.equal(
    assertInventoryResourceWithinScope(
      { business: businessA, location: locationA },
      authority,
      { requireLocation: true }
    ),
    true
  );
  assert.throws(() =>
    assertInventoryResourceWithinScope(
      { business: businessA, location: locationB },
      authority,
      { requireLocation: true }
    )
  );
});

test("inventory aggregate scope is bounded to allowed locations", () => {
  const authority = {
    businessId: businessA,
    locationId: null,
    locationAccessMode: "selected",
    allowedLocationIds: [locationA, locationB],
  };

  assert.deepEqual(resolveInventoryAuthority(authority), {
    businessId: businessA,
    selectedLocationId: null,
    allLocations: false,
    allowedLocationIds: [locationA, locationB],
    scopeMode: "allowed-locations",
  });
  assert.deepEqual(inventoryLocationFilter(authority), {
    business: businessA,
    location: { $in: [locationA, locationB] },
  });
});

test("inventory scope fails closed without authorised locations", () => {
  assert.throws(
    () =>
      resolveInventoryAuthority({
        businessId: businessA,
        locationAccessMode: "selected",
        allowedLocationIds: [],
      }),
    (error) => error?.code === "INVENTORY_LOCATION_SCOPE_EMPTY"
  );
});

test("client-supplied tenant ownership fields are stripped", () => {
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

test("canonical inventory routes resolve trusted tenant and effective authority before permissions", () => {
  const routeFiles = [
    "../features/inventoryPurchasing/routes/supplierRoutes.js",
    "../features/inventoryPurchasing/routes/purchaseOrderRoutes.js",
    "../features/inventoryPurchasing/routes/inventoryPurchasingRoutes.js",
  ];

  for (const routeFile of routeFiles) {
    const routes = source(routeFile);
    assert.match(routes, /workforcePublicTenantContextMiddleware/);
    assert.match(routes, /trustedTenantContextMiddleware/);
    assert.match(routes, /effectiveAuthorityMiddleware/);
    assert.match(
      routes,
      /router\.use\([\s\S]*protect,[\s\S]*workforcePublicTenantContextMiddleware,[\s\S]*trustedTenantContextMiddleware,[\s\S]*effectiveAuthorityMiddleware[\s\S]*\)/
    );
  }
});

test("purchase-order runtime code scopes reads and cannot let request body replace trusted context", () => {
  const controller = source(
    "../features/inventoryPurchasing/controllers/purchaseOrderController.js"
  );
  const service = source(
    "../features/inventoryPurchasing/services/purchaseOrderService.js"
  );

  assert.match(controller, /inventoryLocationFilter\(request\.effectiveAuthority\)/);
  assert.match(controller, /\.\.\.request\.body,[\s\S]*purchaseOrderId: request\.params\.purchaseOrderId,[\s\S]*effectiveAuthority: request\.effectiveAuthority/);
  assert.match(service, /business: authority\.businessId/);
  assert.match(service, /location: authority\.selectedLocationId/);
  assert.match(service, /Product\.findOne\(\{[\s\S]*business: order\.business,[\s\S]*location: order\.location/);
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
