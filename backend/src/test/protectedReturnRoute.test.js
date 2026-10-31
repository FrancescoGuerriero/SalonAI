import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("protected deep links preserve query/hash through sign-in", async () => {
  const [protectedRoute, login, register] = await Promise.all([
    source("../../../frontend/src/Routes/ProtectedRoute.jsx"),
    source("../../../frontend/src/pages/Login.jsx"),
    source("../../../frontend/src/pages/Register.jsx"),
  ]);

  assert.match(
    protectedRoute,
    /location\.pathname\}\$\{location\.search\}\$\{location\.hash/
  );
  assert.match(protectedRoute, /pathname: returnTo/);
  assert.match(protectedRoute, /redirectTo: returnTo/);
  assert.match(login, /location\.state\?\.from\?\.pathname/);
  assert.match(register, /location\.state\?\.from[\s\S]*pathname/);
});
