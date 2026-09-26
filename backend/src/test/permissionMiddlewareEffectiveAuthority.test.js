import assert from "node:assert/strict";
import test from "node:test";

import {
  hasRequestPermission,
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

function responseRecorder() {
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
  return response;
}

test(
  "effective authority overrides unrelated legacy super-admin authority",
  () => {
    const request = {
      user: {
        role: "super_admin",
        permissions: ["employee:delete"],
      },
      effectiveAuthority: {
        roleKey: "manager",
        permissions: ["dashboard:view"],
      },
    };

    assert.equal(
      hasRequestPermission(
        request,
        "employee:update"
      ),
      false
    );

    assert.equal(
      hasRequestPermission(
        request,
        "dashboard:view"
      ),
      true
    );
  }
);

test(
  "legacy permissions remain compatible before effective authority is attached",
  () => {
    const request = {
      user: {
        role: "super_admin",
        permissions: [],
      },
    };

    assert.equal(
      hasRequestPermission(
        request,
        "feature-control:update"
      ),
      true
    );
  }
);

test(
  "an explicitly attached empty effective authority fails closed",
  () => {
    const request = {
      user: {
        role: "super_admin",
      },
      effectiveAuthority: null,
    };

    assert.equal(
      hasRequestPermission(
        request,
        "dashboard:view"
      ),
      false
    );
  }
);

test(
  "requirePermissions checks effective authority before legacy user grants",
  () => {
    const middleware =
      requirePermissions(
        "reports:manage"
      );

    const deniedRequest = {
      requestId: "request-1",
      user: {
        role: "super_admin",
      },
      effectiveAuthority: {
        roleKey: "manager",
        permissions: [
          "reports:read",
        ],
      },
    };

    const deniedResponse =
      responseRecorder();
    let deniedNext = false;

    middleware(
      deniedRequest,
      deniedResponse,
      () => {
        deniedNext = true;
      }
    );

    assert.equal(
      deniedNext,
      false
    );
    assert.equal(
      deniedResponse.statusCode,
      403
    );
    assert.deepEqual(
      deniedResponse.body
        .missingPermissions,
      ["reports:manage"]
    );

    const allowedRequest = {
      ...deniedRequest,
      effectiveAuthority: {
        roleKey: "manager",
        permissions: [
          "reports:manage",
        ],
      },
    };

    const allowedResponse =
      responseRecorder();
    let allowedNext = false;

    middleware(
      allowedRequest,
      allowedResponse,
      () => {
        allowedNext = true;
      }
    );

    assert.equal(
      allowedNext,
      true
    );
    assert.equal(
      allowedResponse.statusCode,
      200
    );
  }
);

test(
  "requireAnyPermission also prefers effective authority",
  () => {
    const middleware =
      requireAnyPermission(
        "communications:read",
        "communications:manage"
      );

    const request = {
      user: {
        role: "super_admin",
      },
      effectiveAuthority: {
        roleKey: "stylist",
        permissions: [
          "dashboard:view",
        ],
      },
    };

    const response =
      responseRecorder();
    let nextCalled = false;

    middleware(
      request,
      response,
      () => {
        nextCalled = true;
      }
    );

    assert.equal(
      nextCalled,
      false
    );
    assert.equal(
      response.statusCode,
      403
    );
    assert.deepEqual(
      response.body.requiredAnyOf,
      [
        "communications:read",
        "communications:manage",
      ]
    );
  }
);
