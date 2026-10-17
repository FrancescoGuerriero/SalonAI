import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

async function source(
  relativePath
) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test(
  "staff account routes use the trusted tenant and effective-authority chain",
  async () => {
    const routes =
      await source(
        "../routes/authRoutes.js"
      );

    assert.match(
      routes,
      /const protectedStaffTenantChain = \[\s*protect,\s*workforcePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*\];/
    );

    assert.match(
      routes,
      /tenantAdminUserController\.js/
    );
    assert.doesNotMatch(
      routes,
      /from "\.\.\/controllers\/adminUserController\.js"/
    );

    for (
      const route of [
        '"/admin/users"',
        '"/admin/staff"',
        '"/admin/staff/:id"',
        '"/admin/staff-record/:id"',
        '"/admin/staff-record/:id/sign-in"',
      ]
    ) {
      const index =
        routes.indexOf(
          route
        );

      assert.notEqual(
        index,
        -1
      );
      assert.match(
        routes.slice(
          index,
          index + 500
        ),
        /\.\.\.protectedStaffTenantChain/
      );
    }
  }
);

test(
  "tenant staff roster is membership-first and never globally lists non-customer Users",
  async () => {
    const controller =
      await source(
        "../controllers/tenantAdminUserController.js"
      );

    assert.match(
      controller,
      /BusinessMembership\.find\(\s*staffMembershipManagementFilter\(req\.effectiveAuthority\)/
    );
    assert.match(
      controller,
      /_id:\s*\{\s*\$in:\s*userIds\s*\}/
    );
    assert.match(
      controller,
      /scopedWorkforceFilter\(req\.effectiveAuthority\)/
    );
    assert.doesNotMatch(
      controller,
      /User\.find\(\{\s*role:\s*\{\s*\$ne:\s*"customer"/
    );
  }
);

test(
  "tenant staff role assignment uses the Business-aware StaffRole resolver",
  async () => {
    const controller =
      await source(
        "../controllers/tenantAdminUserController.js"
      );

    assert.match(
      controller,
      /resolveTenantStaffRole/
    );
    assert.match(
      controller,
      /from "\.\.\/services\/tenantStaffRoleRegistryService\.js"/
    );
    assert.match(
      controller,
      /resolveTenantStaffRole\(\s*roleKey,\s*\{\s*businessId:\s*staffAccountBusinessId\(req\.effectiveAuthority\),\s*activeOnly:\s*true/s
    );
    assert.doesNotMatch(
      controller,
      /resolveStaffRole/
    );
    assert.doesNotMatch(
      controller,
      /from "\.\.\/services\/staffRoleRegistryService\.js"/
    );
  }
);

test(
  "new employee creation persists User, BusinessMembership and tenant-owned Stylist in one transaction",
  async () => {
    const controller =
      await source(
        "../controllers/tenantAdminUserController.js"
      );

    const start =
      controller.indexOf(
        "export async function createTenantStaffUserByAdmin"
      );
    const block =
      controller.slice(
        start,
        controller.indexOf(
          "export async function updateTenantEmployeeServices",
          start
        )
      );

    assert.match(
      block,
      /session\.withTransaction/
    );
    assert.match(
      block,
      /User\.create\(/
    );
    assert.match(
      block,
      /newStaffMembershipPayload\(/
    );
    assert.match(
      block,
      /BusinessMembership\.create\(/
    );
    assert.match(
      block,
      /Stylist\.create\(/
    );
    assert.match(
      block,
      /business:\s*ownership\.businessId/
    );
    assert.match(
      block,
      /workingLocations:\s*ownership\.workingLocationIds/
    );
  }
);

test(
  "Enable sign-in creates a tenant membership before linking the existing employee profile",
  async () => {
    const controller =
      await source(
        "../controllers/tenantAdminUserController.js"
      );

    const start =
      controller.indexOf(
        "async function createTenantIdentity"
      );
    const block =
      controller.slice(
        start,
        controller.indexOf(
          "export async function enableTenantEmployeeSignIn",
          start
        )
      );

    assert.match(
      block,
      /session\.withTransaction/
    );
    assert.match(
      block,
      /newStaffMembershipPayload\(/
    );
    assert.match(
      block,
      /BusinessMembership\.create\(/
    );
    assert.match(
      block,
      /stylist\.userAccount\s*=\s*createdUser\._id/
    );
    assert.match(
      block,
      /workingLocations/
    );
  }
);

test(
  "tenant role and status mutations update BusinessMembership authority instead of only global User state",
  async () => {
    const controller =
      await source(
        "../controllers/tenantAdminUserController.js"
      );

    assert.match(
      controller,
      /membership\.roleKey\s*=\s*update\.role/
    );
    assert.match(
      controller,
      /membership\.status\s*=\s*requested\s*\?\s*"active"\s*:\s*"suspended"/
    );
    assert.match(
      controller,
      /otherActiveMemberships\s*=\s*await BusinessMembership\.countDocuments/
    );
    assert.match(
      controller,
      /Direct User permission overrides are global legacy state and cannot be changed for a multi-Business employee/
    );
    assert.match(
      controller,
      /BusinessMembership\.countDocuments\(\{\s*business:\s*membership\.business,\s*roleKey:\s*"super_admin",\s*status:\s*"active"/
    );
  }
);

test(
  "multi-Business tenant role changes do not rewrite global User role compatibility state",
  async () => {
    const controller =
      await source(
        "../controllers/tenantAdminUserController.js"
      );

    const start =
      controller.indexOf(
        "export async function updateTenantEmployeeManagementSettings"
      );
    const block =
      controller.slice(
        start,
        controller.indexOf(
          "export async function updateTenantAdminUserStatus",
          start
        )
      );

    assert.match(
      block,
      /nonRevokedMembershipCount\s*=\s*await BusinessMembership\.countDocuments\(\{\s*user:\s*user\._id,\s*status:\s*\{\s*\$ne:\s*"revoked"/
    );
    assert.match(
      block,
      /mirrorLegacyRole\s*=\s*Boolean\(update\.role\)\s*&&\s*nonRevokedMembershipCount\s*===\s*1/
    );
    assert.match(
      block,
      /if \(mirrorLegacyRole\) \{\s*user\.role\s*=\s*update\.role;\s*user\.rolePermissions\s*=\s*rolePermissions\(roleDefinition\);/s
    );
    assert.match(
      block,
      /mirroredLegacyRole/
    );
  }
);

test(
  "tenant staff service assignment validates services inside the active Business",
  async () => {
    const controller =
      await source(
        "../controllers/tenantAdminUserController.js"
      );

    assert.match(
      controller,
      /Service\.countDocuments\(\{[\s\S]{0,200}business:\s*staffAccountBusinessId\(req\.effectiveAuthority\)/
    );
  }
);
