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

test("service management separates edit and publication permissions", async () => {
  const routes =
    await source(
      "../routes/serviceRoutes.js"
    );
  const controller =
    await source(
      "../controllers/serviceController.js"
    );

  assert.match(
    routes,
    /"\/management",\s*\.\.\.protectedServiceTenantChain,\s*requirePermissions\(\s*"service:read"/s
  );
  assert.match(
    routes,
    /"\/:id\/publication",\s*\.\.\.protectedServiceTenantChain,\s*requirePermissions\(\s*"service:publish"/s
  );
  assert.match(
    routes,
    /"\/:id",\s*\.\.\.protectedServiceTenantChain,\s*requirePermissions\(\s*"service:update"/s
  );
  assert.match(
    routes,
    /const protectedServiceTenantChain = \[\s*protect,\s*servicePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*\];/
  );
  assert.match(
    controller,
    /delete payload\.published/
  );
  assert.doesNotMatch(
    controller,
    /delete payload\.active/
  );
});

test("new services start unpublished and public direct lookup requires publication", async () => {
  const controller =
    await source(
      "../controllers/serviceController.js"
    );

  assert.match(
    controller,
    /Service\.create\(\{[\s\S]*published:\s*false/
  );
  assert.match(
    controller,
    /PUBLIC_SERVICE_FILTER/
  );
  assert.match(
    controller,
    /active:\s*true/
  );
  assert.match(
    controller,
    /published:\s*true/
  );
});

test("product management separates catalogue, publication and inventory permissions", async () => {
  const routes =
    await source(
      "../features/commerce/commerceRoutes.js"
    );
  const controller =
    await source(
      "../features/commerce/commerceController.js"
    );

  assert.match(
    routes,
    /"\/inventory\/products",\s*protect,\s*servicePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\(\s*"product:read"/s
  );
  assert.match(
    routes,
    /"\/products\/:id\/publication",\s*protect,\s*servicePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\(\s*"product:publish"/s
  );
  assert.match(
    routes,
    /"\/products\/:id\/stock-adjustments",\s*protect,\s*servicePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\(\s*"product:inventory:update"/s
  );
  assert.match(
    controller,
    /delete payload\.active/
  );
  assert.match(
    controller,
    /delete payload\.stockQuantity/
  );
});

test("product catalogue protects cost visibility and supports official copy", async () => {
  const commerce =
    await source(
      "../features/commerce/commerceService.js"
    );
  const controller =
    await source(
      "../features/commerce/commerceController.js"
    );

  assert.match(
    commerce,
    /"officialDescription"/
  );
  assert.match(
    commerce,
    /includeCost/
  );
  assert.match(
    controller,
    /"product:cost:read"/
  );
});

test("public products and checkout remain publication-aware", async () => {
  const commerce =
    await source(
      "../features/commerce/commerceService.js"
    );

  assert.match(
    commerce,
    /if \(!management\) \{\s*match\.active = true;/s
  );
  assert.match(
    commerce,
    /Product\.find\(\{\s*_id: \{ \$in:[\s\S]*active: true,/s
  );
});

test("management navigation exposes separate Products and Inventory workspaces", async () => {
  const navigation =
    await source(
      "../../../frontend/src/components/navigation/managementNavigationConfig.js"
    );
  const app =
    await source(
      "../../../frontend/src/App.jsx"
    );

  assert.match(
    navigation,
    /"\/manage\/products",\s*"Products"/
  );
  assert.match(
    navigation,
    /"\/manage\/inventory",\s*"Inventory"/
  );
  assert.match(
    app,
    /path="manage\/products"/
  );
  assert.match(
    app,
    /"product:read"/
  );
});


test("service catalogue mutations write canonical audit history", async () => {
  const controller =
    await source(
      "../controllers/serviceController.js"
    );

  assert.match(
    controller,
    /recordAuditEvent/
  );

  for (const action of [
    "service.created",
    "service.updated",
    "service.publication_updated",
    "service.deleted",
  ]) {
    assert.ok(
      controller.includes(
        `action:\n        "${action}"`
      ),
      `Missing service audit action: ${action}`
    );
  }

  assert.match(
    controller,
    /changedFields:\s*Object\.keys\(\s*payload\s*\)/
  );
});

test("commerce public and inventory read routes require tenant-bound authority", async () => {
  const routes = await source("../features/commerce/commerceRoutes.js");
  const controller = await source("../features/commerce/commerceController.js");
  const commerce = await source("../features/commerce/commerceService.js");
  assert.match(routes, /"\/products", requireFeature\("online-shop"\), servicePublicTenantContextMiddleware,/);
  assert.match(routes, /"\/products\/:identifier", requireFeature\("online-shop"\), servicePublicTenantContextMiddleware,/);
  assert.match(controller, /publicTenantContext: req\.publicTenantContext/);
  assert.match(controller, /effectiveAuthority: req\.effectiveAuthority/);
  assert.match(commerce, /commercePublicTenantFilter\(publicTenantContext\)/);
  assert.match(commerce, /commerceTenantFilter\(effectiveAuthority\)/);
  assert.match(commerce, /\.\.\.match,\s*active: true/);
});

test("Commerce product write and stock endpoints use effective Business membership authority", async () => {
  const routes = await source("../features/commerce/commerceRoutes.js");
  const controller = await source("../features/commerce/commerceController.js");
  const commerce = await source("../features/commerce/commerceService.js");
  for (const permission of [
    "product:create", "product:update", "product:publish",
    "product:inventory:update", "inventory:read",
  ]) {
    const at = routes.indexOf('"' + permission + '"');
    assert.ok(at > -1, "Missing permission " + permission);
    assert.match(routes.slice(Math.max(0, at - 230), at),
      /servicePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\(/);
  }
  assert.match(controller, /service\.createProduct\([\s\S]*?req\.effectiveAuthority/);
  assert.match(controller, /service\.adjustStock\(req\.params\.id, req\.body, req\.user, req\.effectiveAuthority\)/);
  assert.match(controller, /service\.listStockAdjustments\(req\.params\.id, req\.query, req\.effectiveAuthority\)/);
  assert.match(commerce, /Product\.findOne\(\{ _id: id, \.\.\.owner \}\)/);
  assert.match(commerce, /data\.business = owner\.business/);
  assert.match(commerce, /data\.location = owner\.location/);
});

test("Order management list requires tenant authority and is not the legacy global listing", async () => {
  const routes = await source("../features/commerce/commerceRoutes.js");
  const controller = await source("../features/commerce/commerceController.js");
  const service = await source("../features/commerce/commerceService.js");
  assert.match(routes, /"\/orders",\s*protect,\s*servicePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\("order:read"\)/);
  assert.match(controller, /listTenantOrders\(req\.query, req\.effectiveAuthority\)/);
  assert.match(service, /export async function listTenantOrders\(query = \{\}, effectiveAuthority\)/);
  assert.match(service, /const owner = commerceTenantFilter\(effectiveAuthority\)/);
});
