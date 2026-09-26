import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EMPLOYEE_PERMISSIONS,
  STAFF_ROLE_BASELINE_PERMISSIONS,
} from "../constants/permissions.js";
import {
  permissionScope,
} from "../services/permissionScopeService.js";

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
  "data export management is a canonical allowed-locations permission",
  () => {
    assert.ok(
      EMPLOYEE_PERMISSIONS.includes(
        "data-export:manage"
      )
    );

    assert.ok(
      STAFF_ROLE_BASELINE_PERMISSIONS.admin.includes(
        "data-export:manage"
      )
    );

    assert.equal(
      permissionScope(
        "data-export:manage"
      ),
      "A"
    );
  }
);

test(
  "data export and audit backend uses its dedicated permission",
  async () => {
    const routes =
      await source(
        "../features/futureFeatureRoutes.js"
      );

    assert.match(
      routes,
      /"\/data-export-audit"[\s\S]*requirePermissions\(\s*"data-export:manage"\s*\)[\s\S]*dataExportAuditRoutes/
    );

    assert.doesNotMatch(
      routes,
      /"\/data-export-audit"[\s\S]{0,120}requirePermissions\(\s*"reports:read"\s*\)/
    );
  }
);

test(
  "data export frontend route and navigation use the same canonical permission",
  async () => {
    const app =
      await source(
        "../../../frontend/src/App.jsx"
      );
    const navigation =
      await source(
        "../../../frontend/src/components/navigation/managementNavigationConfig.js"
      );
    const frontendPermissions =
      await source(
        "../../../frontend/src/utils/permissions.js"
      );

    assert.match(
      app,
      /path="data-export-audit"[\s\S]*permissionPage\(DataExportAuditPage,\s*"data-export:manage"\)/
    );

    assert.match(
      navigation,
      /\/data-export-audit[^\n]*data-export:manage/
    );

    assert.doesNotMatch(
      navigation,
      /\/data-export-audit[^\n]*reports:read/
    );

    assert.match(
      frontendPermissions,
      /data-export:manage/
    );
    assert.match(
      frontendPermissions,
      /Manage data exports/
    );
  }
);

test(
  "report viewing stays readable while report downloads require data export authority",
  async () => {
    const parentRoutes =
      await source(
        "../features/futureFeatureRoutes.js"
      );
    const reportRoutes =
      await source(
        "../features/reports/reportRoutes.js"
      );

    assert.match(
      parentRoutes,
      /"\/reports"[\s\S]{0,120}requirePermissions\(\s*"reports:read"\s*\)[\s\S]{0,120}reportRoutes/
    );

    assert.match(
      reportRoutes,
      /"\/summary"[\s\S]{0,100}asyncHandler\(controller\.summary\)/
    );

    for (const exportRoute of [
      "appointments\\.csv",
      "communications\\.csv",
      "management\\.xlsx",
    ]) {
      assert.match(
        reportRoutes,
        new RegExp(
          `"\\/${exportRoute}"[\\s\\S]{0,160}requirePermissions\\(\\s*"data-export:manage"\\s*\\)`
        )
      );
    }
  }
);

test(
  "reports centre only presents download actions to users with data export authority",
  async () => {
    const page =
      await source(
        "../../../frontend/src/pages/ReportsCentrePage.jsx"
      );

    assert.match(
      page,
      /hasPermission\(\s*user,\s*"data-export:manage"\s*\)/
    );

    assert.match(
      page,
      /canExportReports\s*\?\s*\(/
    );

    assert.match(
      page,
      /data export permission has not been assigned/
    );
  }
);

