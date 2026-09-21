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

test(
  "legacy admin user creation delegates to the canonical governed employee flow",
  async () => {
    const routes =
      await source(
        "../routes/authRoutes.js"
      );

    const controller =
      await source(
        "../controllers/authController.js"
      );

    const start =
      routes.indexOf(
        'router.post(\n  "/admin/users"'
      );

    assert.ok(
      start >= 0,
      "Legacy /admin/users compatibility route is missing."
    );

    const end =
      routes.indexOf(
        ");",
        start
      );

    const route =
      routes.slice(
        start,
        end
      );

    assert.match(
      route,
      /"employee:create"/
    );

    assert.match(
      route,
      /createStaffUserByAdmin/
    );

    assert.doesNotMatch(
      route,
      /adminOnly/
    );

    assert.doesNotMatch(
      routes,
      /createUserByAdmin/
    );

    assert.doesNotMatch(
      controller,
      /export async function createUserByAdmin/
    );
  }
);

test(
  "legacy admin dashboard uses delegated dashboard permission rather than a role-only bypass",
  async () => {
    const routes =
      await source(
        "../routes/adminRoutes.js"
      );

    assert.match(
      routes,
      /requirePermissions\(\s*"dashboard:view"\s*\)/
    );

    assert.doesNotMatch(
      routes,
      /adminOnly/
    );
  }
);
