import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(here, "../../scripts/applyStaffRoleTenantBackfill.js"),
  "utf8"
);

test("StaffRole guarded apply records transactional migration provenance after postflight", () => {
  assert.match(source, /import AuditLog from/);
  assert.match(
    source,
    /tenant_migration\.staff_role_business_backfill/
  );
  assert.match(source, /transactionalPostflight/);
  assert.match(source, /await writeMigrationAudit\(/);
  assert.match(source, /\{ session \}/);
  assert.match(source, /reviewedFingerprint/);
  assert.match(source, /rollback:/);
  assert.match(source, /identifiersIncluded: false/);
  assert.match(source, /permissionsIncluded: false/);
});
