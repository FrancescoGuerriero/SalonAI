import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

function responseRecorder() {
  const state = {
    statusCode: 200,
    body: null,
  };

  return {
    state,
    status(code) {
      state.statusCode =
        code;
      return this;
    },
    json(body) {
      state.body =
        body;
      return this;
    },
  };
}

function runAiPermission(
  user
) {
  const middleware =
    requirePermissions(
      "ai:use"
    );
  const response =
    responseRecorder();
  let nextCalled =
    false;

  middleware(
    {
      user,
      requestId:
        "ai-custom-role-test",
    },
    response,
    () => {
      nextCalled =
        true;
    }
  );

  return {
    nextCalled,
    response:
      response.state,
  };
}

test("custom staff roles can use AI when ai:use is granted by their role template", () => {
  const result =
    runAiPermission({
      role:
        "colour_specialist",
      rolePermissions: [
        "ai:use",
      ],
      permissions: [],
    });

  assert.equal(
    result.nextCalled,
    true
  );
  assert.equal(
    result.response.body,
    null
  );
});

test("custom roles and built-in staff without ai:use remain denied", () => {
  for (const user of [
    {
      role:
        "colour_specialist",
      rolePermissions: [],
      permissions: [],
    },
    {
      role:
        "receptionist",
      permissions: [],
    },
    {
      role:
        "customer",
      permissions: [],
    },
  ]) {
    const result =
      runAiPermission(
        user
      );

    assert.equal(
      result.nextCalled,
      false
    );
    assert.equal(
      result.response
        .statusCode,
      403
    );
    assert.equal(
      result.response
        .body?.code,
      "INSUFFICIENT_PERMISSIONS"
    );
  }
});

test("AI router uses delegated ai:use instead of the legacy management role allowlist", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiRecommendationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /router\.use\(protect\)[\s\S]*?router\.use\([\s\S]*?requirePermissions\([\s\S]*?"ai:use"/
  );

  assert.equal(
    routes.includes(
      "managementOnly"
    ),
    false
  );
});
