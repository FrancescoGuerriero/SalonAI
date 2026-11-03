import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("membership module exposes an operational tenant management workspace", async () => {
  const page = await source("../../../frontend/src/pages/MembershipManagementPage.jsx");
  const service = await source("../../../frontend/src/Services/membershipService.js");
  const router = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const navigation = await source("../../../frontend/src/components/navigation/managementNavigationConfig.js");
  const backendRoutes = await source("../features/memberships/membershipRoutes.js");

  assert.match(service, /const BASE_URL = "\/future\/memberships"/);
  for (const operation of [
    "getMembershipPlans",
    "createMembershipPlan",
    "updateMembershipPlan",
    "getMembershipContracts",
    "createMembershipContract",
    "freezeMembershipContract",
    "resumeMembershipContract",
    "recordMembershipCollection",
    "getMembershipBenefits",
  ]) {
    assert.match(service, new RegExp(`function ${operation}|${operation}\\(`));
  }

  assert.match(page, /Membership management/);
  assert.match(page, /customerSegmentationService\.getCustomers/);
  assert.match(page, /createMembershipPlan/);
  assert.match(page, /createMembershipContract/);
  assert.match(page, /freezeMembershipContract/);
  assert.match(page, /resumeMembershipContract/);
  assert.match(page, /recordMembershipCollection/);
  assert.match(page, /getMembershipBenefits/);

  assert.match(router, /pathname === "\/memberships"/);
  assert.match(router, /hasPermission\(user, "customer:read"\)/);
  assert.match(navigation, /"\/memberships", "Memberships"/);

  for (const path of [
    '"/plans"',
    '"/contracts"',
    '"/contracts/:id/freeze"',
    '"/contracts/:id/resume"',
    '"/contracts/:id/collections"',
    '"/contracts/:id/benefits"',
  ]) {
    assert.match(backendRoutes, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("membership mutations remain permission-gated on both frontend and backend", async () => {
  const page = await source("../../../frontend/src/pages/MembershipManagementPage.jsx");
  const backendRoutes = await source("../features/memberships/membershipRoutes.js");

  assert.match(page, /hasPermission\(user, "customer:update"\)/);
  assert.match(backendRoutes, /requirePermissions\("customer:update"\)/);
  assert.match(backendRoutes, /requirePermissions\("customer:read"\)/);
});
