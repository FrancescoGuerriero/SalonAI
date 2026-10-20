import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL(
    "../features/consultations/consultationSessionRoutes.js",
    import.meta.url
  ),
  "utf8"
);

test("consultation routes resolve trusted tenant and effective authority before permissions", () => {
  assert.match(
    routeSource,
    /router\.use\([\s\S]*?protect,[\s\S]*?workforcePublicTenantContextMiddleware,[\s\S]*?trustedTenantContextMiddleware,[\s\S]*?effectiveAuthorityMiddleware[\s\S]*?\);/
  );
});

test("consultation CRUD and review endpoints use the canonical permission namespace", () => {
  const expectations = [
    [/router\.get\([\s\S]*?"\/"[\s\S]*?"consultation:read"/, "list/read"],
    [/router\.post\([\s\S]*?"\/"[\s\S]*?"consultation:create"/, "create"],
    [/"\/:consultationId"[\s\S]*?"consultation:read"/, "detail/read"],
    [/router\.patch\([\s\S]*?"\/:consultationId"[\s\S]*?"consultation:update"/, "update"],
    [/"\/:consultationId\/assign"[\s\S]*?"consultation:assign"/, "assign"],
    [/"\/:consultationId\/review"[\s\S]*?"consultation:review"/, "review"],
    [/"\/:consultationId\/approve"[\s\S]*?"consultation:approve"/, "approve"],
  ];

  for (const [pattern, label] of expectations) {
    assert.match(routeSource, pattern, `missing ${label} permission guard`);
  }
});

test("AI assistance requires both consultation mutation authority and ai use authority", () => {
  assert.match(
    routeSource,
    /"\/:consultationId\/assist"[\s\S]*?requirePermissions\("consultation:update", "ai:use"\)/
  );
});
