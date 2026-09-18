import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("management navigation requires delegated permissions for core workspaces", async () => {
  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const expected = [
    [
      "/dashboard",
      "dashboard:view",
    ],
    [
      "/appointments",
      "appointment:read",
    ],
    [
      "/customers",
      "customer:read",
    ],
    [
      "/manage/services",
      "service:read",
    ],
    [
      "/manage/products",
      "product:read",
    ],
    [
      "/manage/inventory",
      "inventory:read",
    ],
    [
      "/communications",
      "communications:read",
    ],
    [
      "/ai/haircare",
      "ai:use",
    ],
  ];

  for (const [
    route,
    permission,
  ] of expected) {
    const routeIndex =
      navigation.indexOf(
        `"${route}"`
      );

    assert.ok(
      routeIndex >= 0,
      `Missing management route: ${route}`
    );

    const nearby =
      navigation.slice(
        routeIndex,
        routeIndex + 240
      );

    assert.ok(
      nearby.includes(
        `"${permission}"`
      ),
      `${route} is missing ${permission}`
    );
  }
});

test("staff-profile navigation requires own or all-profile read authority", async () => {
  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    navigation,
    /canReadOwnProfile/
  );
  assert.match(
    navigation,
    /canReadAllProfiles/
  );
  assert.match(
    navigation,
    /link\.to !== "\/staff\/profile"/
  );
});
