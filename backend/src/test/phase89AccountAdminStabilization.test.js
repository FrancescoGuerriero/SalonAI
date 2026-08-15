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

function executeGuard(guard, role) {
  let nextCalled = false;
  let nextError = null;

  guard(
    {
      user: {
        _id: `${role}-user`,
        role,
      },
    },
    {},
    (error) => {
      nextCalled = true;
      nextError = error || null;
    }
  );

  return {
    nextCalled,
    nextError,
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
  "new product creation is administrator only",
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

    const adminGuard =
      route.stack[1].handle;

    for (const role of [
      "stylist",
      "receptionist",
      "manager",
      "customer",
    ]) {
      const result =
        executeGuard(
          adminGuard,
          role
        );

      assert.equal(
        result.nextCalled,
        true
      );
      assert.equal(
        result.nextError?.statusCode,
        403
      );
    }

    const adminResult =
      executeGuard(
        adminGuard,
        "admin"
      );

    assert.equal(
      adminResult.nextCalled,
      true
    );
    assert.equal(
      adminResult.nextError,
      null
    );
  }
);
