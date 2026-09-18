import assert from "node:assert/strict";
import test from "node:test";

import commerceRoutes from "../features/commerce/commerceRoutes.js";
import stylistRoutes from "../routes/stylistRoutes.js";
import {
  getMyStaffProfile,
  updateMyStaffProfile,
} from "../controllers/staffSelfProfileController.js";

function findRoute(router, path, method) {
  return router.stack.find(
    (layer) =>
      layer.route?.path === path &&
      Boolean(layer.route.methods?.[method])
  )?.route;
}

function executeGuard(
  guard,
  role,
  permissions = []
) {
  let nextCalled = false;
  let nextError = null;
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  guard(
    {
      user: {
        _id: `${role}-user`,
        role,
        permissions,
      },
    },
    response,
    (error) => {
      nextCalled = true;
      nextError = error || null;
    }
  );

  return {
    nextCalled,
    nextError,
    response,
  };
}

test(
  "staff self-profile controller exposes read and save handlers",
  () => {
    assert.equal(
      typeof getMyStaffProfile,
      "function"
    );
    assert.equal(
      typeof updateMyStaffProfile,
      "function"
    );
  }
);

test(
  "staff self-profile routes remain protected management routes",
  () => {
    const getRoute = findRoute(
      stylistRoutes,
      "/me/profile",
      "get"
    );
    const patchRoute = findRoute(
      stylistRoutes,
      "/me/profile",
      "patch"
    );

    assert.ok(getRoute);
    assert.ok(patchRoute);
    assert.equal(
      getRoute.stack.length,
      3
    );
    assert.equal(
      patchRoute.stack.length,
      3
    );
  }
);

test(
  "new product creation follows delegated product:create permission",
  () => {
    const route = findRoute(
      commerceRoutes,
      "/products",
      "post"
    );

    assert.ok(route);
    assert.equal(
      route.stack.length,
      3
    );

    const permissionGuard =
      route.stack[1].handle;

    const denied =
      executeGuard(
        permissionGuard,
        "admin"
      );

    assert.equal(
      denied.nextCalled,
      false
    );
    assert.equal(
      denied.response.statusCode,
      403
    );

    const delegated =
      executeGuard(
        permissionGuard,
        "admin",
        ["product:create"]
      );

    assert.equal(
      delegated.nextCalled,
      true
    );
    assert.equal(
      delegated.nextError,
      null
    );

    const superAdmin =
      executeGuard(
        permissionGuard,
        "super_admin"
      );

    assert.equal(
      superAdmin.nextCalled,
      true
    );
    assert.equal(
      superAdmin.nextError,
      null
    );
  }
);
