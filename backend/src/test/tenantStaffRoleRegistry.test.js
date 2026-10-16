import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  trustedStaffRoleBusinessFilter,
} from "../services/tenantStaffRoleRegistryService.js";

const BUSINESS_A = "507f1f77bcf86cd799439011";

test("tenant StaffRole filter requires a valid trusted Business id", () => {
  assert.deepEqual(
    String(
      trustedStaffRoleBusinessFilter(BUSINESS_A).business
    ),
    BUSINESS_A
  );

  assert.throws(
    () =>
      trustedStaffRoleBusinessFilter("client-supplied-business"),
    (error) => error.statusCode === 400
  );
});

test("tenant StaffRole resolver never falls back to globally unowned role documents", async () => {
  const source = await readFile(
    new URL(
      "../services/tenantStaffRoleRegistryService.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /StaffRole\.findOne\(\{[\s\S]*business,[\s\S]*key,?[\s\S]*\}\)/
  );
  assert.match(
    source,
    /StaffRole\.find\(\{[\s\S]*business,[\s\S]*\}\)/
  );
  assert.doesNotMatch(source, /business:\s*null/);
  assert.doesNotMatch(source, /\$or/);
});

test("StaffRole schema adds Business ownership without dropping transitional global key uniqueness", async () => {
  const source = await readFile(
    new URL(
      "../models/StaffRole.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /business:[\s\S]*ref:\s*"Business"/
  );
  assert.match(
    source,
    /key:[\s\S]*unique:\s*true/
  );
  assert.match(
    source,
    /business:\s*1,[\s\S]*key:\s*1/
  );
});
