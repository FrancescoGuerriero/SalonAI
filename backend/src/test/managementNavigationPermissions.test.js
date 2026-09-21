import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function managementNavigationSource() {
  const [
    component,
    config,
  ] =
    await Promise.all([
      readFile(
        new URL(
          "../../../frontend/src/components/navigation/ManagementNavigation.jsx",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../../../frontend/src/components/navigation/managementNavigationConfig.js",
          import.meta.url
        ),
        "utf8"
      ),
    ]);

  return `${component}\n${config}`;
}

test("management navigation requires delegated permissions for core workspaces", async () => {
  const navigation =
    await managementNavigationSource();

  const expected = [
    ["/dashboard", "dashboard:view"],
    ["/appointments", "appointment:read"],
    ["/staff/self-service", "schedule:own:read"],
    ["/team-availability", "employee:read"],
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
    await managementNavigationSource();

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


test("Super Admin and Admin bypass menu hiding while other staff remain permission-driven", async () => {
  const navigation =
    await managementNavigationSource();

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
      /FULL_DASHBOARD_ROLES\s*=\s*new Set\(\[([\s\S]*?)\]\)/
    );

  assert.ok(
    fullDashboardBlock
  );
  assert.match(
    fullDashboardBlock[1],
    /"super_admin"/
  );
  assert.match(
    fullDashboardBlock[1],
    /"admin"/
  );
  assert.doesNotMatch(
    fullDashboardBlock[1],
    /"manager"|"receptionist"|"stylist"/
  );
});

test("restored dashboard exposes planning marketing growth and performance routes", async () => {
  const navigation =
    await managementNavigationSource();

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
    await managementNavigationSource();

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
    await managementNavigationSource();

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
    /featureDisabled/
  );
  assert.match(
    navigation,
    /aria-disabled/
  );
  assert.match(
    navigation,
    /Currently off/
  );
  assert.match(
    navbar,
    /superAdminPreview\s*\|\|\s*isFeatureEnabled/
  );
});

test("only Super Admin and Admin retain unconditional full dashboard visibility", async () => {
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
  assert.match(
    fullDashboardBlock[1],
    /"super_admin"/
  );
  assert.match(
    fullDashboardBlock[1],
    /"admin"/
  );
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
    await managementNavigationSource();

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


test("Admin overview stays administrator-only while legacy operational URLs redirect to guarded canonical workspaces", async () => {
  const adminRoute =
    await readFile(
      new URL(
        "../../../frontend/src/Routes/AdminRoute.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const app =
    await readFile(
      new URL(
        "../../../frontend/src/App.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigation =
    await managementNavigationSource();

  assert.match(
    adminRoute,
    /isAdminRole/
  );

  const adminOverview =
    app.match(
      /<Route[\s\S]*?path="admin"[\s\S]*?\/>/
    )?.[0] || "";

  assert.match(
    adminOverview,
    /adminPage\(/
  );

  for (const [
    legacyPath,
    canonicalPath,
    permission,
  ] of [
    [
      "admin/services",
      "manage/services",
      "service:read",
    ],
    [
      "admin/stylists",
      "staff/profile",
      "profile:own:read",
    ],
    [
      "admin/appointments",
      "appointments",
      "appointment:read",
    ],
    [
      "admin/customers",
      "customers",
      "customer:read",
    ],
    [
      "admin/staff-accounts",
      "admin/employees",
      "employee:read",
    ],
  ]) {
    const routeBlocks =
      [
        ...app.matchAll(
          /<Route\b[\s\S]*?\/>/g
        ),
      ].map(
        (match) =>
          match[0]
      );

    const legacyRoute =
      routeBlocks.find(
        (block) =>
          block.includes(
            `path="${legacyPath}"`
          )
      ) || "";

    assert.match(
      legacyRoute,
      /<Navigate/
    );
    assert.match(
      legacyRoute,
      new RegExp(
        `to="/${canonicalPath.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        )}"`
      )
    );

    const canonicalRoute =
      routeBlocks.find(
        (block) =>
          block.includes(
            `path="${canonicalPath}"`
          )
      ) || "";

    assert.match(
      canonicalRoute,
      new RegExp(
        `permissionPage\\([\\s\\S]*?"${permission.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        )}"\\s*\\)`
      )
    );

    assert.doesNotMatch(
      navigation,
      new RegExp(
        `\\["/${legacyPath.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        )}"`
      )
    );
  }

  assert.match(
    navigation,
    /\["\/admin",[^\n]*true,\s*"dashboard:view"\]/
  );
});


test("team availability is canonical while legacy staff-management URL redirects", async () => {
  const app =
    await readFile(
      new URL(
        "../../../frontend/src/App.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigation =
    await managementNavigationSource();

  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/StaffManagementPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    navigation,
    /\["\/team-availability",\s*"Team availability",\s*"Working hours and time off"/
  );
  assert.doesNotMatch(
    navigation,
    /\["\/staff-management"/
  );

  const teamRoute =
    [...app.matchAll(/<Route\b[\s\S]*?\/>/g)]
      .map((match) => match[0])
      .find((block) =>
        block.includes('path="team-availability"')
      ) || "";

  assert.match(
    teamRoute,
    /permissionPage\(StaffManagementPage,\s*"employee:read"\)/
  );

  const legacyRoute =
    [...app.matchAll(/<Route\b[\s\S]*?\/>/g)]
      .map((match) => match[0])
      .find((block) =>
        block.includes('path="staff-management"')
      ) || "";

  assert.match(
    legacyRoute,
    /<Navigate/
  );
  assert.match(
    legacyRoute,
    /to="\/team-availability"/
  );

  assert.match(
    page,
    />Team availability</
  );
  assert.doesNotMatch(
    page,
    />Staff management</
  );
});

test("feature-controlled dashboard entries remain visible when the feature is off", async () => {
  const navigation =
    await managementNavigationSource();

  assert.match(
    navigation,
    /featureDisabled/
  );
  assert.match(
    navigation,
    /aria-disabled/
  );
  assert.match(
    navigation,
    /Currently off/
  );
});


test("every dashboard link declares a permission and matches its route guard", async () => {
  const app =
    await readFile(
      new URL(
        "../../../frontend/src/App.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const navigation =
    await managementNavigationSource();

  const links = [
    ...navigation.matchAll(
      /\["(\/[^"]+)",\s*"[^"]+",\s*"[^"]+",\s*(?:"[A-Za-z0-9_]+"|[A-Za-z0-9_]+)(?:,\s*(true|false))?,\s*"([^"]*)"/g
    ),
  ].map(
    (match) => ({
      path:
        match[1].slice(1),
      adminOnly:
        match[2] === "true",
      permission:
        match[3],
    })
  );

  assert.ok(
    links.length > 0
  );

  assert.equal(
    new Set(
      links.map(
        (link) =>
          link.path
      )
    ).size,
    links.length,
    "Management navigation must not expose duplicate route entries."
  );

  for (const link of links) {
    assert.ok(
      link.permission,
      `Missing permission for /${link.path}`
    );

    const routeBlock = [
      ...app.matchAll(
        /<Route\b[\s\S]*?\/>/g
      ),
    ]
      .map(
        (match) =>
          match[0]
      )
      .find(
        (block) =>
          block.includes(
            `path="${link.path}"`
          )
      );

    assert.ok(
      routeBlock,
      `Missing route for /${link.path}`
    );

    if (
      link.adminOnly
    ) {
      assert.match(
        routeBlock,
        /adminPage\(/
      );
    } else {
      assert.match(
        routeBlock,
        new RegExp(
          `permissionPage\\([\\s\\S]*?"${link.permission.replace(
            /[-/\\^$*+?.()|[\]{}]/g,
            "\\$&"
          )}"\\s*\\)`
        ),
        `Route guard mismatch for /${link.path}`
      );
    }
  }
});
