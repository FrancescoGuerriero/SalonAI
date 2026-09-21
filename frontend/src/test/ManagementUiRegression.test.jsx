import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function source(
  relativePath
) {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      relativePath
    ),
    "utf8"
  );
}

describe(
  "management UI regressions",
  () => {
    it(
      "integrates individual employee access management into Staff Roles",
      () => {
        const page =
          source(
            "src/pages/StaffRoleManagementPage.jsx"
          );

        expect(
          page
        ).toContain(
          "EmployeeAccessPanel"
        );
        expect(
          page
        ).toContain(
          "canReadEmployees"
        );
      }
    );


    it(
      "loads optional shell assistants on demand instead of the shared startup path",
      () => {
        const layout =
          source(
            "src/components/MainLayout.jsx"
          );

        expect(
          layout
        ).toContain(
          "const SalonChatbot = lazy("
        );
        expect(
          layout
        ).toContain(
          "const SalonAiAdviser = lazy("
        );
        expect(
          layout
        ).toContain(
          "<Suspense fallback={null}>"
        );
        expect(
          layout
        ).not.toContain(
          'import SalonChatbot from "./chatbot/SalonChatbot.jsx"'
        );
        expect(
          layout
        ).not.toContain(
          'import SalonAiAdviser from "./ai/SalonAiAdviser.jsx"'
        );
        expect(
          layout
        ).toContain(
          "const ManagementNavigation = lazy("
        );
        expect(
          layout
        ).toContain(
          'from "./navigation/managementNavigationConfig.js"'
        );
        expect(
          layout
        ).not.toContain(
          'import ManagementNavigation from "./navigation/ManagementNavigation.jsx"'
        );
      }
    );


    it(
      "keeps legacy admin URLs as redirects without duplicating management navigation",
      () => {
        const app =
          source(
            "src/App.jsx"
          );
        const navigation =
          `${source(
            "src/components/navigation/ManagementNavigation.jsx"
          )}\n${source(
            "src/components/navigation/managementNavigationConfig.js"
          )}`;
        const adminDashboard =
          source(
            "src/pages/AdminDashboard.jsx"
          );

        for (const [legacy, canonical] of [
          ["admin/services", "/manage/services"],
          ["admin/stylists", "/staff/profile"],
          ["admin/appointments", "/appointments"],
          ["admin/customers", "/customers"],
          ["admin/staff-accounts", "/admin/employees"],
        ]) {
          expect(
            app
          ).toContain(
            `path="${legacy}"`
          );
          expect(
            app
          ).toContain(
            `to="${canonical}"`
          );
        }

        for (const legacyPath of [
          "/admin/services",
          "/admin/stylists",
          "/admin/appointments",
          "/admin/customers",
          "/admin/staff-accounts",
        ]) {
          expect(
            navigation
          ).not.toContain(
            `["${legacyPath}"`
          );
        }

        expect(
          navigation
        ).toContain(
          '["/admin/system", "On/Off Ideas"'
        );
        expect(
          adminDashboard
        ).toContain(
          '"/manage/services"'
        );
        expect(
          adminDashboard
        ).toContain(
          '"/appointments"'
        );
        expect(
          adminDashboard
        ).toContain(
          '"/customers"'
        );
        expect(
          adminDashboard
        ).toContain(
          '"/staff/profile"'
        );
      }
    );


    it(
      "keeps the Add Employee dialog inside the viewport with a fixed shell and internal scrolling",
      () => {
        const modal =
          source(
            "src/components/employees/AddEmployeeModal.jsx"
          );

        expect(
          modal
        ).toContain(
          "createPortal"
        );
        expect(
          modal
        ).toContain(
          "z-[400]"
        );
        expect(
          modal
        ).toContain(
          "max-h-[calc(100dvh-1rem)]"
        );
        expect(
          modal
        ).toContain(
          "flex-col overflow-hidden"
        );
        expect(
          modal
        ).toContain(
          "overflow-x-hidden overflow-y-auto"
        );
        expect(
          modal
        ).toContain(
          "shrink-0 flex items-start justify-between"
        );
        expect(
          modal
        ).toContain(
          "shrink-0 flex flex-col-reverse"
        );
        expect(
          modal
        ).not.toContain(
          "fixed inset-0 z-50 flex items-center justify-center"
        );
        expect(
          modal
        ).not.toContain(
          "sticky top-0"
        );
        expect(
          modal
        ).not.toContain(
          "sticky bottom-0"
        );
      }
    );

    it(
      "keeps services and schedule operational when employee sign-in is disabled",
      () => {
        const page =
          source(
            "src/pages/AdminEmployeeDetailPage.jsx"
          );
        const service =
          source(
            "src/Services/adminStaffService.js"
          );

        expect(
          page
        ).toContain(
          "adminStaffService.updateRecordServices"
        );
        expect(
          page
        ).toContain(
          "adminStaffService.updateRecordSchedule"
        );
        expect(
          page
        ).toContain(
          "adminStaffService.updateServices"
        );
        expect(
          page
        ).toContain(
          "adminStaffService.updateSchedule"
        );
        expect(
          page
        ).not.toContain(
          "const canManageServices =\n    !signInDisabled"
        );
        expect(
          page
        ).not.toContain(
          "const canUpdateSchedule =\n    !signInDisabled"
        );
        expect(
          service
        ).toContain(
          "/auth/admin/staff-record/${recordId}/services"
        );
        expect(
          service
        ).toContain(
          "/auth/admin/staff-record/${recordId}/schedule"
        );
      }
    );


    it(
      "renders the product editor at the application overlay layer with internal scrolling",
      () => {
        const page =
          source(
            "src/pages/ProductManagementPage.jsx"
          );

        expect(
          page
        ).toContain(
          "createPortal"
        );
        expect(
          page
        ).toContain(
          "z-[400]"
        );
        expect(
          page
        ).toContain(
          "max-h-[calc(100dvh-1rem)]"
        );
        expect(
          page
        ).toContain(
          "flex-col overflow-hidden"
        );
        expect(
          page
        ).toContain(
          "overflow-x-hidden overflow-y-auto"
        );
        expect(
          page
        ).toContain(
          "shrink-0 flex flex-col-reverse"
        );
        expect(
          page
        ).not.toContain(
          "fixed inset-0 z-50 flex items-center justify-center"
        );
      }
    );
  }
);
