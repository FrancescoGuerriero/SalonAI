import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "staff creation sensitive fields use request-aware canonical permissions",
  async () => {
    const controller = await source(
      "../controllers/adminUserController.js"
    );

    assert.match(
      controller,
      /roleDefinition\.superAdminOnly[\s\S]{0,220}hasRequestPermission\(\s*req,\s*"employee:role:update"\s*\)/
    );

    assert.match(
      controller,
      /permissions\.length[\s\S]{0,180}hasRequestPermission\(\s*req,\s*"employee:permissions:update"\s*\)/
    );

    for (const permission of [
      "employee:services:update",
      "employee:schedule:update",
      "employee:deactivate",
    ]) {
      assert.match(
        controller,
        new RegExp(
          `hasRequestPermission\\(\\s*req,\\s*"${permission}"\\s*\\)`
        )
      );
    }

    assert.doesNotMatch(
      controller,
      /hasUserPermission/
    );

    assert.doesNotMatch(
      controller,
      /\["super_admin",\s*"admin"\][\s\S]{0,100}permissions\.length/
    );
  }
);

test(
  "staff creation route still requires employee create authority",
  async () => {
    const routes = await source(
      "../routes/authRoutes.js"
    );

    assert.match(
      routes,
      /\.route\("\/admin\/staff"\)[\s\S]{0,420}\.post\([\s\S]{0,180}requirePermissions\(\s*"employee:create"\s*\)[\s\S]{0,180}createStaffUserByAdmin/
    );
  }
);

test(
  "add employee role and permission presentation follows canonical permissions",
  async () => {
    const modal = await source(
      "../../../frontend/src/components/employees/AddEmployeeModal.jsx"
    );

    assert.match(
      modal,
      /hasPermission\(\s*user,\s*"employee:role:update"\s*\)/
    );

    assert.match(
      modal,
      /hasPermission\(\s*user,\s*"employee:permissions:update"\s*\)/
    );

    assert.doesNotMatch(
      modal,
      /isAdminRole|isSuperAdminRole/
    );
  }
);

test(
  "employee management role controls use role-update capability",
  async () => {
    const accounts = await source(
      "../../../frontend/src/pages/AdminStaffAccountsPage.jsx"
    );
    const details = await source(
      "../../../frontend/src/pages/AdminEmployeeDetailPage.jsx"
    );
    const panel = await source(
      "../../../frontend/src/components/employees/EmployeeAccessPanel.jsx"
    );

    assert.match(
      accounts,
      /hasPermission\(\s*currentUser,\s*"employee:role:update"\s*\)/
    );

    assert.match(
      details,
      /hasPermission\(\s*currentUser,\s*"employee:role:update"\s*\)/
    );

    assert.match(
      panel,
      /selectedEmployee\?\.role ===[\s\S]{0,80}"super_admin"[\s\S]{0,80}!canManageRoles/
    );

    assert.doesNotMatch(
      accounts,
      /isSuperAdminRole/
    );
    assert.doesNotMatch(
      details,
      /isSuperAdminRole/
    );
  }
);
