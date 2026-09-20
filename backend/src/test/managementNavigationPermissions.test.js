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
    ["/dashboard", "dashboard:view"],
    ["/appointments", "appointment:read"],
    ["/staff/self-service", "schedule:own:read"],
    ["/customers", "customer:read"],
    ["/manage/services", "service:read"],
    ["/manage/products", "product:read"],
    ["/manage/inventory", "inventory:read"],
    ["/communications", "communications:read"],
    ["/ai/haircare", "ai:use"],
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
        routeIndex + 260
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


test("Admin and Super Admin bypass menu hiding while other management roles remain permission-driven", async () => {
  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const roles =
    await readFile(
      new URL(
        "../../../frontend/src/utils/roles.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    navigation,
    /hasFullManagementDashboard/
  );
  assert.match(
    navigation,
    /fullDashboard \|\| hasPermission/
  );

  const fullDashboardBlock =
    roles.match(
      /FULL_DASHBOARD_ROLES\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)/
    );

  assert.ok(fullDashboardBlock);

  for (const role of [
    "super_admin",
    "admin",
  ]) {
    assert.match(
      fullDashboardBlock[1],
      new RegExp(`"${role}"`)
    );
  }

  assert.doesNotMatch(
    fullDashboardBlock[1],
    /"manager"|"receptionist"|"stylist"/
  );
});

test("restored dashboard exposes planning marketing growth and performance routes", async () => {
  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  for (const route of [
    "/calendar",
    "/waitlist",
    "/booking-demand",
    "/booking-loss",
    "/customer-follow-ups",
    "/customer-value",
    "/retention-predictions",
    "/rebooking-opportunities",
    "/rebooking-campaigns",
    "/marketing-attribution",
    "/revenue-forecast",
    "/reports",
    "/staff-rota",
    "/staff-performance",
    "/service-performance",
    "/executive-command-centre",
    "/data-export-audit",
  ]) {
    assert.match(
      navigation,
      new RegExp(
        route.replace(
          /\//g,
          "\\/"
        )
      ),
      `Missing restored dashboard route: ${route}`
    );
  }
});


test("every primary management and admin route is represented in dashboard navigation", async () => {
  const app =
    await readFile(
      new URL(
        "../../../frontend/src/App.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigationPaths =
    new Set(
      [
        ...navigation.matchAll(
          /\["(\/[^"]+)"/g
        ),
      ].map(
        (match) =>
          match[1]
      )
    );

  const routeBlocks = [
    ...app.matchAll(
      /<Route[\s\S]*?\/>/g
    ),
  ].map(
    (match) =>
      match[0]
  );

  const missing = [];

  for (const block of routeBlocks) {
    if (
      !/managementPage\(|permissionPage\(|adminPage\(/.test(
        block
      )
    ) {
      continue;
    }

    const match =
      block.match(
        /path="([^"]+)"/
      );

    if (!match) {
      continue;
    }

    const path =
      `/${match[1]}`;

    if (
      /:\w+/.test(
        path
      ) ||
      path.endsWith(
        "/new"
      )
    ) {
      continue;
    }

    if (
      !navigationPaths.has(
        path
      )
    ) {
      missing.push(
        path
      );
    }
  }

  assert.deepEqual(
    missing,
    []
  );
});

test("global top navigation remains mounted on management pages", async () => {
  const layout =
    await readFile(
      new URL(
        "../../../frontend/src/components/MainLayout.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    layout,
    /<Navbar \/>/
  );
  assert.doesNotMatch(
    layout,
    /!management\s*\?\s*<Navbar/
  );
});

test("Super Admin can inspect feature-disabled development pages", async () => {
  const featureRoute =
    await readFile(
      new URL(
        "../../../frontend/src/Routes/FeatureRoute.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navbar =
    await readFile(
      new URL(
        "../../../frontend/src/components/Navbar.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    featureRoute,
    /isSuperAdminRole/
  );
  assert.match(
    featureRoute,
    /!superAdminPreview\s*&&\s*!isFeatureEnabled/
  );
  assert.match(
    navigation,
    /isSuperAdminRole\(\s*user\?\.role\s*\)\s*\|\|\s*isFeatureEnabled/
  );
  assert.match(
    navbar,
    /superAdminPreview\s*\|\|\s*isFeatureEnabled/
  );
});

test("only Admin and Super Admin retain full restored dashboard visibility", async () => {
  const roles =
    await readFile(
      new URL(
        "../../../frontend/src/utils/roles.js",
        import.meta.url
      ),
      "utf8"
    );

  const fullDashboardBlock =
    roles.match(
      /FULL_DASHBOARD_ROLES\s*=\s*new Set\(\[([\s\S]*?)\]\)/
    );

  assert.ok(
    fullDashboardBlock
  );
  for (const role of [
    "super_admin",
    "admin",
  ]) {
    assert.match(
      fullDashboardBlock[1],
      new RegExp(
        `"${role}"`
      )
    );
  }

  assert.doesNotMatch(
    fullDashboardBlock[1],
    /"manager"|"receptionist"|"stylist"/
  );
});


test("dashboard navigation contains no dead primary links", async () => {
  const app =
    await readFile(
      new URL(
        "../../../frontend/src/App.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const routePaths =
    new Set(
      [
        ...app.matchAll(
          /path="([^"]+)"/g
        ),
      ].map(
        (match) =>
          `/${match[1]}`
      )
    );

  const navigationPaths =
    [
      ...navigation.matchAll(
        /\["(\/[^"]+)"/g
      ),
    ].map(
      (match) =>
        match[1]
    );

  const dead =
    navigationPaths.filter(
      (path) =>
        !routePaths.has(
          path
        )
    );

  assert.deepEqual(
    dead,
    []
  );
});


test("restored administrator routes use Admin-or-Super-Admin visibility", async () => {
  const adminRoute =
    await readFile(
      new URL(
        "../../../frontend/src/Routes/AdminRoute.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const systemRoutes =
    await readFile(
      new URL(
        "../routes/systemAdministrationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    adminRoute,
    /isAdminRole/
  );
  assert.match(
    navigation,
    /!link\.adminOnly \|\| isAdminRole/
  );
  assert.match(
    systemRoutes,
    /router\.get\("\/features", adminOnly/
  );
  assert.match(
    systemRoutes,
    /router\.patch\([\s\S]*superAdminOnly/
  );
});
