import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");

const removedAuthorities = [
  path.join(SRC_ROOT, "features", "whatsapp"),
  path.join(SRC_ROOT, "features", "capacityPlanning", "whatsapp"),
];

test("legacy WhatsApp authorities remain removed", () => {
  for (const authorityPath of removedAuthorities) {
    assert.equal(
      fs.existsSync(authorityPath),
      false,
      `legacy WhatsApp authority must not reappear: ${authorityPath}`
    );
  }
});

test("application mounts the canonical premium WhatsApp route authority", () => {
  const appSource = fs.readFileSync(path.join(SRC_ROOT, "app.js"), "utf8");

  assert.match(
    appSource,
    /\.\/features\/premium\/whatsapp\/whatsappRoutes\.js/
  );
  assert.doesNotMatch(
    appSource,
    /\.\/features\/whatsapp\/whatsappRoutes\.js/
  );
  assert.doesNotMatch(
    appSource,
    /\.\/features\/capacityPlanning\/whatsapp\/whatsappRoutes\.js/
  );
});
