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

test("customer routes require granular delegated permissions", async () => {
  const routes =
    await source(
      "../routes/customerRoutes.js"
    );

  const expectations = [
    [
      /router\.get\(\s*"\/",[\s\S]*?"customer:read"/,
      "customer list",
    ],
    [
      /router\.get\(\s*"\/:id",[\s\S]*?"customer:read"/,
      "customer detail",
    ],
    [
      /router\.post\(\s*"\/",[\s\S]*?"customer:create"/,
      "customer create",
    ],
    [
      /router\.put\(\s*"\/:id",[\s\S]*?"customer:update"/,
      "customer update",
    ],
    [
      /"\/:id\/archive"[\s\S]*?"customer:archive"/,
      "customer archive",
    ],
    [
      /"\/:id\/restore"[\s\S]*?"customer:archive"/,
      "customer restore",
    ],
    [
      /router\.delete\(\s*"\/:id",[\s\S]*?"customer:delete"/,
      "customer delete",
    ],
  ];

  for (const [
    pattern,
    label,
  ] of expectations) {
    assert.match(
      routes,
      pattern,
      `Missing permission guard for ${label}`
    );
  }

  assert.doesNotMatch(
    routes,
    /adminOnly/
  );
});

test("appointment communication and payment actions are explicitly delegated", async () => {
  const routes =
    await source(
      "../features/appointments/appointmentManagementRoutes.js"
    );

  for (const pattern of [
    /"\/queue-reminders"[\s\S]*?"communications:manage"/,
    /"\/:id\/reminder"[\s\S]*?"communications:manage"/,
    /"\/:id\/communications\/reminder"[\s\S]*?"communications:manage"/,
    /"\/:id\/communications"[\s\S]*?"communications:read"/,
    /"\/:id\/payments\/checkout"[\s\S]*?"appointment:payment:manage"/,
    /"\/:id\/payments\/:paymentId\/confirm-demo"[\s\S]*?"appointment:payment:manage"/,
  ]) {
    assert.match(
      routes,
      pattern
    );
  }
});

test("permission catalogues expose customer and appointment payment capabilities", async () => {
  const backend =
    await source(
      "../constants/permissions.js"
    );
  const frontend =
    await source(
      "../../../frontend/src/utils/permissions.js"
    );

  for (const permission of [
    "customer:create",
    "customer:archive",
    "customer:delete",
    "appointment:payment:manage",
  ]) {
    assert.ok(
      backend.includes(
        `"${permission}"`
      ),
      `Backend permission missing: ${permission}`
    );

    assert.ok(
      frontend.includes(
        `"${permission}"`
      ),
      `Frontend permission missing: ${permission}`
    );
  }
});
