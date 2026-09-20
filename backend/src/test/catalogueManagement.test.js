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
    /"\/management",\s*protect,\s*requirePermissions\(\s*"service:read"/s
  );
  assert.match(
    routes,
    /"\/:id\/publication",\s*protect,\s*requirePermissions\(\s*"service:publish"/s
  );
  assert.match(
    routes,
    /"\/:id",\s*protect,\s*requirePermissions\(\s*"service:update"/s
  );
  assert.match(
    controller,
    /delete payload\.published/
  );
});

test("new services start unpublished and public direct lookup requires publication", async () => {
  const controller =
    await source(
      "../controllers/serviceController.js"
    );

  assert.match(
    controller,
    /payload\.published\s*=\s*false/
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
    /"\/inventory\/products",\s*protect,\s*requirePermissions\(\s*"product:read"/s
  );
  assert.match(
    routes,
    /"\/products\/:id\/publication",\s*protect,\s*requirePermissions\(\s*"product:publish"/s
  );
  assert.match(
    routes,
    /"\/products\/:id\/stock-adjustments",\s*protect,\s*requirePermissions\(\s*"product:inventory:update"/s
  );
  assert.match(
    controller,
    /delete payload\.published/
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
      "../../../frontend/src/components/navigation/ManagementNavigation.jsx"
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


test("service availability uses independent active published and bookable states", async () => {
  const model =
    await source(
      "../models/service.js"
    );
  const migration =
    await source(
      "../../scripts/migrateServiceAvailability.js"
    );

  for (const field of [
    "active",
    "published",
    "bookable",
  ]) {
    assert.match(
      model,
      new RegExp(
        `${field}:\\s*\\{`
      )
    );
  }

  assert.match(
    migration,
    /onlineBookable/
  );
  assert.match(
    migration,
    /\$unset/
  );
  assert.match(
    migration,
    /set\.bookable/
  );
});
