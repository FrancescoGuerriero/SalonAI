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
      "defers external calendar connection loading until requested",
      () => {
        const page =
          source(
            "src/pages/CalendarPage.jsx"
          );

        expect(
          page
        ).toContain(
          "const StaffCalendarConnections = lazy"
        );
        expect(
          page
        ).toContain(
          "Manage external calendars"
        );
        expect(
          page
        ).toContain(
          "showConnections ?"
        );
        expect(
          page
        ).toContain(
          'aria-controls="external-calendar-connections"'
        );
        expect(
          page
        ).toContain(
          "<Suspense"
        );
        expect(
          page
        ).not.toContain(
          'import StaffCalendarConnections from'
        );
      }
    );


    it(
      "progressively discloses dense management navigation without removing authorised routes",
      () => {
        const navigation =
          source(
            "src/components/navigation/ManagementNavigation.jsx"
          );
        const registry =
          source(
            "src/components/navigation/managementNavigationConfig.js"
          );

        expect(
          navigation
        ).toContain(
          "MANAGEMENT_SECTION_PREVIEW = 5"
        );
        expect(
          navigation
        ).toContain(
          "Show fewer tools"
        );
        expect(
          navigation
        ).toContain(
          "more tools"
        );
        expect(
          navigation
        ).toContain(
          "Boolean(query)"
        );
        expect(
          navigation
        ).toContain(
          "aria-expanded"
        );

        expect(
          registry
        ).toContain(
          "/communication-campaigns"
        );
        expect(
          registry
        ).toContain(
          "/management-copilot"
        );
        expect(
          registry
        ).toContain(
          "/premium-analytics"
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
      "keeps non-appointment staff blocks inside the canonical internal calendar",
      () => {
        const calendar =
          source(
            "src/components/calendar/AppointmentCalendar.jsx"
          );
        const dialog =
          source(
            "src/components/calendar/ScheduleBlockDialog.jsx"
          );
        const api =
          source(
            "src/Services/futureFeaturesApi.js"
          );

        expect(
          calendar
        ).toContain(
          'kind:\n                  "schedule_block"'
        );
        expect(
          calendar
        ).toContain(
          "staffApi.listCalendarBlocks"
        );
        expect(
          calendar
        ).toContain(
          "const ScheduleBlockDialog =\n  lazy("
        );
        expect(
          calendar
        ).toContain(
          '"employee:schedule:update"'
        );
        expect(
          calendar
        ).toContain(
          "Add schedule block"
        );

        expect(
          dialog
        ).toContain(
          "createPortal"
        );
        expect(
          dialog
        ).toContain(
          "max-h-[calc(100dvh-1rem)]"
        );
        expect(
          dialog
        ).toContain(
          "Reserve staff availability without creating a customer appointment."
        );
        expect(
          dialog
        ).toContain(
          "staffApi.createCalendarBlock"
        );
        expect(
          dialog
        ).toContain(
          "staffApi.cancelCalendarBlock"
        );
        expect(
          dialog
        ).not.toContain(
          "appointmentManagementApi.create"
        );

        expect(
          api
        ).toContain(
          "/staff/calendar-blocks"
        );
        expect(
          api
        ).toContain(
          "/calendar-blocks"
        );
      }
    );


    it(
      "enforces route-specific bundle budgets for measured heavy management routes",
      () => {
        const budget =
          source(
            "scripts/check-bundle-budget.mjs"
          );

        expect(
          budget
        ).toContain(
          "calendarRouteJsGzip: 85 * 1024"
        );
        expect(
          budget
        ).toContain(
          "communicationCampaignsRouteJsGzip:"
        );
        expect(
          budget
        ).toContain(
          "36 * 1024"
        );
        expect(
          budget
        ).toContain(
          '"CalendarPage"'
        );
        expect(
          budget
        ).toContain(
          '"CommunicationCampaignsPage"'
        );
        expect(
          budget
        ).toContain(
          '"Calendar route JavaScript"'
        );
        expect(
          budget
        ).toContain(
          '"Communication campaigns route JavaScript"'
        );
      }
    );


    it(
      "shows operational social-auth status instead of placeholder controls",
      () => {
        const socialOptions =
          source(
            "src/components/auth/SocialSignInOptions.jsx"
          );
        const login =
          source(
            "src/pages/Login.jsx"
          );
        const register =
          source(
            "src/pages/Register.jsx"
          );
        const administration =
          source(
            "src/pages/SystemAdministrationPage.jsx"
          );

        expect(
          socialOptions
        ).toContain(
          "setup required"
        );
        expect(
          socialOptions
        ).toContain(
          "Social sign-in is not active on this environment yet"
        );
        expect(
          socialOptions
        ).toContain(
          'mode === "register"'
        );
        expect(
          login
        ).toContain(
          'mode="login"'
        );
        expect(
          register
        ).toContain(
          'mode="register"'
        );
        expect(
          administration
        ).toContain(
          "Sign-in providers"
        );
        expect(
          administration
        ).toContain(
          "/system-administration/social-auth-readiness"
        );
        expect(
          administration
        ).toContain(
          "Client secrets are never returned to the browser"
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
