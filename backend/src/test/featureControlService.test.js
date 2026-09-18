import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PUBLIC_STYLIST_FIELDS } from "../controllers/stylistController.js";
import CanonicalAuditLog from "../models/AuditLog.js";
import FutureFeatureAuditLog from "../features/security/AuditLog.js";
import {
  FEATURE_CONTROLS,
  createRequireFeature,
  featureSettingKey,
  normaliseFeatureControlUpdate,
  resolveFeatureControls,
} from "../services/featureControlService.js";

test("feature controls provide unique boolean code defaults", () => {
  assert.ok(FEATURE_CONTROLS.length >= 25);
  assert.equal(new Set(FEATURE_CONTROLS.map(({ id }) => id)).size, FEATURE_CONTROLS.length);

  for (const definition of FEATURE_CONTROLS) {
    assert.equal(typeof definition.defaultEnabled, "boolean");
    assert.ok(definition.label);
    assert.ok(definition.category);
  }
});

test("administrator overrides take precedence and missing values use code defaults", () => {
  const states = resolveFeatureControls([
    {
      key: featureSettingKey("online-booking"),
      value: false,
      updatedAt: new Date("2026-09-17T10:00:00.000Z"),
    },
  ]);

  const booking = states.find(({ id }) => id === "online-booking");
  const shop = states.find(({ id }) => id === "online-shop");
  const privacy = states.find(({ id }) => id === "privacy");

  assert.equal(booking.enabled, false);
  assert.equal(booking.source, "admin");
  assert.equal(shop.enabled, true);
  assert.equal(shop.source, "code-default");
  assert.equal(privacy.enabled, true);
  assert.equal(privacy.required, true);
});

test("feature updates require a known optional feature and a boolean", () => {
  assert.deepEqual(
    normaliseFeatureControlUpdate("online-shop", { enabled: false }),
    {
      definition: FEATURE_CONTROLS.find(({ id }) => id === "online-shop"),
      key: "feature.online-shop.enabled",
      enabled: false,
    }
  );
  assert.throws(
    () => normaliseFeatureControlUpdate("online-shop", { enabled: "false" }),
    /boolean/
  );
  assert.throws(
    () => normaliseFeatureControlUpdate("not-real", { enabled: false }),
    /not supported/
  );
  assert.throws(
    () => normaliseFeatureControlUpdate("privacy", { enabled: false }),
    /required control/
  );
});

test("disabled feature middleware fails closed with a stable error code", async () => {
  const requireFeature = createRequireFeature(async () => false);
  const middleware = requireFeature("online-booking");
  const error = await new Promise((resolve) => middleware({}, {}, resolve));

  assert.equal(error.statusCode, 404);
  assert.equal(error.code, "FEATURE_DISABLED");
  assert.deepEqual(error.details, { featureId: "online-booking" });
});

test("stylist API separates protected management data from public booking data", async () => {
  const routes = await readFile(
    new URL("../routes/stylistRoutes.js", import.meta.url),
    "utf8"
  );

  assert.match(routes, /"\/booking",\s*requireFeature\("online-booking"\),\s*getBookingStylists/s);
  assert.match(
    routes,
    /"\/",\s*protect,\s*requirePermissions\(\s*"profile:all:read"\s*\),\s*getStylists/s
  );
  assert.match(
    routes,
    /"\/me\/profile",\s*protect,\s*requirePermissions\(\s*"profile:own:read"\s*\),\s*getMyStaffProfile/s
  );
  assert.doesNotMatch(PUBLIC_STYLIST_FIELDS, /acceptsAppointments/);
  assert.doesNotMatch(PUBLIC_STYLIST_FIELDS, /profilePublished/);
  assert.doesNotMatch(PUBLIC_STYLIST_FIELDS, /isActive/);
});

test("customer booking can be disabled without disabling staff appointment work", async () => {
  const routes = await readFile(
    new URL("../routes/appointmentRoutes.js", import.meta.url),
    "utf8"
  );

  assert.match(routes, /const managementRoles = new Set\(\[/);
  assert.match(routes, /"super_admin"/);
  assert.match(routes, /"admin"/);
  assert.match(routes, /"manager"/);
  assert.match(routes, /"receptionist"/);
  assert.match(routes, /"stylist"/);
  assert.match(routes, /managementRoles\.has\(request\.user\?\.role\)/);
  assert.match(routes, /requireCustomerOnlineBooking\(request, response, next\)/);
});

test("system administration feature controls are mounted and Super-Admin-only", async () => {
  const routes = await readFile(
    new URL("../routes/systemAdministrationRoutes.js", import.meta.url),
    "utf8"
  );
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(routes, /router\.use\(protect\)/);
  assert.match(routes, /router\.use\(superAdminOnly\)/);
  assert.match(routes, /router\.patch\("\/features\/:featureId"/);
  assert.match(app, /"\/api\/system-administration"/);
  assert.match(app, /"\/api\/app-configuration"/);
});


test("system and future-feature audits use distinct Mongoose models", () => {
  assert.equal(CanonicalAuditLog.modelName, "AuditLog");
  assert.equal(
    FutureFeatureAuditLog.modelName,
    "FutureFeatureAuditLog"
  );
  assert.notEqual(
    CanonicalAuditLog,
    FutureFeatureAuditLog
  );
  assert.ok(
    CanonicalAuditLog.schema.path(
      "resourceType"
    )
  );
  assert.ok(
    FutureFeatureAuditLog.schema.path(
      "entityType"
    )
  );
});
