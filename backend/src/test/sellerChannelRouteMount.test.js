import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Module 15 routes are mounted through authenticated future API", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const future = await readFile(new URL(
    "../features/futureFeatureRoutes.js", import.meta.url), "utf8");
  const seller = await readFile(new URL(
    "../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8");
  assert.match(app, /app\.use\(\s*"\/api\/future",\s*futureFeatureRoutes/);
  assert.match(future, /import sellerChannelRoutes from "\.\/partnerMarketplace\/sellerChannelRoutes\.js"/);
  assert.match(future, /router\.use\("\/seller-channels", sellerChannelRoutes\)/);
  assert.ok(future.indexOf("router.use(protect)") >= 0);
  assert.ok(future.indexOf('router.use("/seller-channels"') >
    future.indexOf("router.use(protect)"));
  assert.match(seller, /router\.use\(protect, trustedTenantContextMiddleware, effectiveAuthorityMiddleware\)/);
  assert.match(seller, /router\.post\("\/:connectionId\/diagnose"/);
  assert.match(seller, /router\.post\("\/:connectionId\/order-links\/:externalOrderId\/propose"/);
});

test("nested seller routes remain protected and cannot be reached via unscoped public API", async () => {
  const future = await readFile(new URL(
    "../features/futureFeatureRoutes.js", import.meta.url), "utf8");
  assert.ok(future.indexOf("router.use(protect)") <
    future.indexOf('router.use("/seller-channels"'));
  assert.ok(future.indexOf("router.use(auditFutureWrites)") <
    future.indexOf('router.use("/seller-channels"'));
});
