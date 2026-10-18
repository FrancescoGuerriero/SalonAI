import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(
  here,
  "../../../.github/workflows/production-customer-appointment-tenant-readiness.yml"
);
const source = fs.readFileSync(workflowPath, "utf8");

test("Customer/Appointment production readiness workflow is read-only, release-bound and deterministic", () => {
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /expected_release_tag:/);
  assert.match(source, /environment: production/);
  assert.match(source, /StrictHostKeyChecking=yes/);
  assert.match(source, /checkCustomerAppointmentTenantReadiness\.js/);
  assert.match(source, /planCustomerAppointmentTenantBackfill\.js/);
  assert.match(source, /plan1\.planFingerprint !== plan2\.planFingerprint/);
  assert.match(source, /readiness\.safeForBackfill !== true/);
  assert.match(source, /plan\.writesPerformed !== false/);
  assert.doesNotMatch(source, /applyCustomerAppointmentTenantBackfill\.js/);
  assert.doesNotMatch(source, /--apply/);
  assert.doesNotMatch(source, /docker compose .*up/);
});
