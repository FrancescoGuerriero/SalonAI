import {
  readFileSync,
} from "node:fs";
import {
  dirname,
  resolve,
} from "node:path";
import {
  fileURLToPath,
} from "node:url";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = resolve(
  dirname(
    fileURLToPath(
      import.meta.url
    )
  ),
  ".."
);

function source(relativePath) {
  return readFileSync(
    resolve(root, relativePath),
    "utf8"
  );
}

describe(
  "unified QueueVisit reception workspace",
  () => {
    it(
      "switches the Reception page to the unified QueueVisit workspace",
      () => {
        const page = source("pages/AppointmentsPage.jsx");
        expect(page).toContain("UnifiedReceptionWorkspace.jsx");
        expect(page).toContain("ReceptionWorkspace");
        expect(page).toContain("AppointmentsOperationsPage");
      }
    );

    it(
      "loads canonical queue visits and excludes them from scheduled arrivals",
      () => {
        const workspace = source(
          "components/appointments/UnifiedReceptionWorkspace.jsx"
        );
        expect(workspace).toContain("appointmentManagementApi.getQueueVisits");
        expect(workspace).toContain("appointmentManagementApi.getCalendar");
        expect(workspace).toContain("queueAppointmentIds");
        expect(workspace).toContain("appointmentManagementApi.getWalkInQueue");
        expect(workspace).toContain("appointmentManagementApi.updateStatus");
        expect(workspace).not.toContain("fetch(");
      }
    );

    it(
      "offers both walk-in and call-ahead entry using the existing appointment permissions",
      () => {
        const workspace = source(
          "components/appointments/UnifiedReceptionWorkspace.jsx"
        );
        const dialog = source(
          "components/appointments/CallAheadDialog.jsx"
        );
        expect(workspace).toContain("Add walk-in");
        expect(workspace).toContain("Add call-ahead");
        expect(workspace).toContain('"appointment:read"');
        expect(workspace).toContain('"appointment:create"');
        expect(workspace).toContain('"appointment:update"');
        expect(workspace).toContain('"appointment:cancel"');
        expect(dialog).toContain("appointmentManagementApi.createQueueVisit");
        expect(dialog).toContain('queueSource: "call_ahead"');
        expect(dialog).toContain("Creates a canonical phone appointment");
      }
    );

    it(
      "shows queue source and queue metrics without duplicating lifecycle state",
      () => {
        const workspace = source(
          "components/appointments/UnifiedReceptionWorkspace.jsx"
        );
        expect(workspace).toContain("Call ahead");
        expect(workspace).toContain("Walk-in");
        expect(workspace).toContain("expectedArrivalAt");
        expect(workspace).toContain("averageWaitMinutes");
        expect(workspace).toContain("queueState");
        expect(workspace).toContain("item.status");
      }
    );

    it(
      "keeps call-ahead creation viewport-safe and on the canonical booking engine",
      () => {
        const dialog = source(
          "components/appointments/CallAheadDialog.jsx"
        );
        expect(dialog).toContain("createPortal");
        expect(dialog).toContain("max-h-[calc(100dvh-1rem)]");
        expect(dialog).toContain("same booking engine and appointment lifecycle");
        expect(dialog).not.toContain("Appointment.create");
        expect(dialog).not.toContain("fetch(");
      }
    );
  }
);
