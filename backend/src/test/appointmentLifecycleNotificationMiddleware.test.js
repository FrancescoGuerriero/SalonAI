import assert from "node:assert/strict";
import test from "node:test";

import appointmentRoutes from "../routes/appointmentRoutes.js";
import appointmentManagementRoutes from "../features/appointments/appointmentManagementRoutes.js";
import {
  appointmentLifecycleNotification,
} from "../features/appointments/appointmentLifecycleNotificationMiddleware.js";

function routePaths(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      handlers: layer.route.stack.map((entry) => entry.handle.name),
    }));
}

test("appointment lifecycle notification middleware exports a route factory", () => {
  assert.equal(typeof appointmentLifecycleNotification, "function");
  assert.equal(typeof appointmentLifecycleNotification("created"), "function");
});

test("customer booking creation route includes lifecycle notification middleware", () => {
  const routes = routePaths(appointmentRoutes);
  const createRoute = routes.find(
    (route) => route.path === "/" && route.methods.includes("post")
  );

  assert.ok(createRoute);
  assert.ok(
    createRoute.handlers.includes("appointmentLifecycleNotificationMiddleware")
  );
});

test("management reschedule and status routes include lifecycle notification middleware", () => {
  const routes = routePaths(appointmentManagementRoutes);

  for (const path of ["/:id/reschedule", "/:id/status"]) {
    const route = routes.find((entry) => entry.path === path);
    assert.ok(route, `Expected route ${path}.`);
    assert.ok(
      route.handlers.includes("appointmentLifecycleNotificationMiddleware"),
      `Expected lifecycle middleware on ${path}.`
    );
  }
});
