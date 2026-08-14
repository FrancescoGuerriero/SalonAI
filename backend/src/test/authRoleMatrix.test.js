import assert from "node:assert/strict";
import test from "node:test";

import {
  adminOnly,
  authorize,
  managementOnly,
} from "../middleware/authMiddleware.js";

function executeGuard(guard, user) {
  const request = {
    headers: {},
  };

  if (user !== undefined) {
    request.user = user;
  }

  let nextCalled = false;
  let nextError = null;

  guard(
    request,
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

function assertAllowed(guard, role) {
  const result = executeGuard(
    guard,
    {
      _id: `${role}-user`,
      role,
    }
  );

  assert.equal(
    result.nextCalled,
    true
  );

  assert.equal(
    result.nextError,
    null
  );
}

function assertDenied(
  guard,
  role,
  expectedStatus = 403
) {
  const result = executeGuard(
    guard,
    {
      _id: `${role}-user`,
      role,
    }
  );

  assert.equal(
    result.nextCalled,
    true
  );

  assert.ok(
    result.nextError instanceof Error
  );

  assert.equal(
    result.nextError.statusCode,
    expectedStatus
  );

  assert.equal(
    result.nextError.status,
    expectedStatus
  );

  return result.nextError;
}

test(
  "authorize rejects requests without an authenticated user",
  () => {
    const guard = authorize(
      "admin"
    );

    const result =
      executeGuard(
        guard,
        undefined
      );

    assert.equal(
      result.nextCalled,
      true
    );

    assert.ok(
      result.nextError instanceof Error
    );

    assert.equal(
      result.nextError.statusCode,
      401
    );

    assert.equal(
      result.nextError.message,
      "Authentication is required before authorisation can be checked."
    );
  }
);

test(
  "adminOnly permits only the admin role",
  () => {
    assertAllowed(
      adminOnly,
      "admin"
    );

    const deniedRoles = [
      "customer",
      "stylist",
      "receptionist",
      "manager",
      "owner",
    ];

    for (
      const role of deniedRoles
    ) {
      const error =
        assertDenied(
          adminOnly,
          role
        );

      assert.equal(
        error.message,
        "You do not have permission to perform this action."
      );
    }
  }
);

test(
  "managementOnly permits the configured management roles",
  () => {
    const allowedRoles = [
      "admin",
      "stylist",
      "receptionist",
      "manager",
    ];

    for (
      const role of allowedRoles
    ) {
      assertAllowed(
        managementOnly,
        role
      );
    }
  }
);

test(
  "managementOnly rejects customer and owner roles",
  () => {
    const deniedRoles = [
      "customer",
      "owner",
    ];

    for (
      const role of deniedRoles
    ) {
      assertDenied(
        managementOnly,
        role
      );
    }
  }
);

test(
  "admin-manager guard permits exactly admin and manager",
  () => {
    const guard =
      authorize(
        "admin",
        "manager"
      );

    assertAllowed(
      guard,
      "admin"
    );

    assertAllowed(
      guard,
      "manager"
    );

    const deniedRoles = [
      "customer",
      "stylist",
      "receptionist",
      "owner",
    ];

    for (
      const role of deniedRoles
    ) {
      assertDenied(
        guard,
        role
      );
    }
  }
);

test(
  "customer-only guard permits customers and rejects staff roles",
  () => {
    const guard =
      authorize(
        "customer"
      );

    assertAllowed(
      guard,
      "customer"
    );

    const deniedRoles = [
      "admin",
      "manager",
      "stylist",
      "receptionist",
      "owner",
    ];

    for (
      const role of deniedRoles
    ) {
      assertDenied(
        guard,
        role
      );
    }
  }
);

test(
  "stylist-only guard permits stylists and rejects other roles",
  () => {
    const guard =
      authorize(
        "stylist"
      );

    assertAllowed(
      guard,
      "stylist"
    );

    const deniedRoles = [
      "customer",
      "admin",
      "manager",
      "receptionist",
      "owner",
    ];

    for (
      const role of deniedRoles
    ) {
      assertDenied(
        guard,
        role
      );
    }
  }
);