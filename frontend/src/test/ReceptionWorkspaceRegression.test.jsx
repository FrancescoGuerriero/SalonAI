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
    resolve(
      root,
      relativePath
    ),
    "utf8"
  );
}

describe(
  "unified reception workspace",
  () => {
    it(
      "keeps reception and full appointment operations on the existing appointments route",
      () => {
        const page =
          source(
            "pages/AppointmentsPage.jsx"
          );
        const app =
          source(
            "App.jsx"
          );

        expect(page).toContain(
          "ReceptionWorkspace"
        );
        expect(page).toContain(
          "AppointmentsOperationsPage"
        );
        expect(page).toContain(
          'useState("reception")'
        );
        expect(page).toContain(
          "All appointments"
        );
        expect(app).toContain(
          '"./pages/AppointmentsPage.jsx"'
        );
        expect(app).not.toContain(
          'path="/front-desk"'
        );
      }
    );

    it(
      "uses canonical appointment APIs for scheduled arrivals and walk-ins",
      () => {
        const reception =
          source(
            "components/appointments/ReceptionWorkspace.jsx"
          );
        const dialog =
          source(
            "components/appointments/WalkInDialog.jsx"
          );

        expect(reception).toContain(
          "appointmentManagementApi.getCalendar"
        );
        expect(reception).toContain(
          "appointmentManagementApi.getWalkInQueue"
        );
        expect(reception).toContain(
          "appointmentManagementApi.updateStatus"
        );
        expect(dialog).toContain(
          "appointmentManagementApi.createWalkIn"
        );
        expect(dialog).not.toContain(
          "fetch("
        );
        expect(reception).not.toContain(
          "fetch("
        );
      }
    );

    it(
      "uses existing RBAC vocabulary rather than front-desk-specific permissions",
      () => {
        const reception =
          source(
            "components/appointments/ReceptionWorkspace.jsx"
          );

        expect(reception).toContain(
          '"appointment:read"'
        );
        expect(reception).toContain(
          '"appointment:create"'
        );
        expect(reception).toContain(
          '"appointment:update"'
        );
        expect(reception).toContain(
          '"appointment:cancel"'
        );
        expect(reception).not.toMatch(
          /front[-_]desk:[a-z]+/i
        );
      }
    );

    it(
      "keeps walk-in creation viewport-safe and clearly canonical",
      () => {
        const dialog =
          source(
            "components/appointments/WalkInDialog.jsx"
          );

        expect(dialog).toContain(
          "createPortal"
        );
        expect(dialog).toContain(
          "max-h-[calc(100dvh-1rem)]"
        );
        expect(dialog).toContain(
          "same booking engine used for scheduled appointments"
        );
        expect(dialog).toContain(
          "Creates a normal appointment with walk-in as its booking source."
        );
      }
    );

    it(
      "does not introduce a separate persisted queue contract in the frontend",
      () => {
        const reception =
          source(
            "components/appointments/ReceptionWorkspace.jsx"
          );

        expect(reception).toContain(
          "queuePosition"
        );
        expect(reception).toContain(
          "queuedAt"
        );
        expect(reception).not.toContain(
          "queueId"
        );
        expect(reception).not.toContain(
          "manualQueueOrder"
        );
      }
    );
  }
);
