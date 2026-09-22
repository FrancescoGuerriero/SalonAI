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
  "walk-in creation delegates to the canonical appointment creator",
  async () => {
    const service =
      await source(
        "../features/appointments/walkInService.js"
      );

    const start =
      service.indexOf(
        "async function createWalkInAppointment"
      );
    const end =
      service.indexOf(
        "async function listWalkInQueue",
        start
      );
    const handler =
      service.slice(
        start,
        end
      );

    assert.match(
      service,
      /createManagedAppointment/
    );
    assert.match(
      handler,
      /createManagedAppointment\(/
    );
    assert.match(
      handler,
      /status:\s*"pending"/
    );
    assert.match(
      handler,
      /bookingSource:[\s\S]*?"walk_in"/
    );
    assert.doesNotMatch(
      handler,
      /Appointment\.create\(/
    );
    assert.doesNotMatch(
      handler,
      /findConflict\(/
    );
    assert.doesNotMatch(
      handler,
      /Stylist\.find/
    );
    assert.doesNotMatch(
      handler,
      /Service\.find/
    );
  }
);

test(
  "walk-in queue is a projection of canonical appointments rather than a second queue model",
  async () => {
    const service =
      await source(
        "../features/appointments/walkInService.js"
      );

    assert.match(
      service,
      /Appointment\.find\(/
    );
    assert.match(
      service,
      /bookingSource:[\s\S]*?"walk_in"/
    );
    assert.match(
      service,
      /TERMINAL_STATUSES/
    );
    assert.match(
      service,
      /createdAt:\s*1/
    );
    assert.match(
      service,
      /queuePosition,[\s\S]*?index \+ 1/
    );
    assert.match(
      service,
      /queuedAt:[\s\S]*?value\.createdAt/
    );
    assert.doesNotMatch(
      service,
      /new Schema\(/
    );
    assert.doesNotMatch(
      service,
      /mongoose\.model\(/
    );
  }
);

test(
  "front-desk states derive from existing appointment lifecycle statuses",
  async () => {
    const service =
      await source(
        "../features/appointments/walkInService.js"
      );

    const start =
      service.indexOf(
        "function frontDeskState"
      );
    const end =
      service.indexOf(
        "function queueProjection",
        start
      );
    const mapping =
      service.slice(
        start,
        end
      );

    assert.match(
      mapping,
      /case "pending":[\s\S]*?return "waiting"/
    );
    assert.match(
      mapping,
      /case "confirmed":[\s\S]*?return "assigned"/
    );
    assert.match(
      mapping,
      /case "checked_in":[\s\S]*?return "checked_in"/
    );
    assert.match(
      mapping,
      /case "in_progress":[\s\S]*?return "in_service"/
    );
    assert.doesNotMatch(
      service,
      /WALK_IN_STATUSES/
    );
  }
);

test(
  "walk-in routes reuse appointment permissions and lifecycle notification",
  async () => {
    const routes =
      await source(
        "../features/appointments/appointmentManagementRoutes.js"
      );

    const walkIns =
      routes.indexOf(
        '"/walk-ins"'
      );
    const individual =
      routes.indexOf(
        '"/:id"'
      );

    assert.ok(
      walkIns >= 0
    );
    assert.ok(
      individual > walkIns,
      "walk-in routes must be registered before the appointment identifier route"
    );
    assert.match(
      routes,
      /"\/walk-ins"[\s\S]*?"appointment:read"[\s\S]*?walkInQueue/
    );
    assert.match(
      routes,
      /"\/walk-ins"[\s\S]*?"appointment:create"[\s\S]*?appointmentLifecycleNotification\([\s\S]*?"created"[\s\S]*?createWalkIn/
    );
    assert.doesNotMatch(
      routes,
      /walk_in:read|walk_in:create|front_desk:create/
    );
  }
);

test(
  "walk-in lifecycle changes remain on the existing appointment status route",
  async () => {
    const routes =
      await source(
        "../features/appointments/appointmentManagementRoutes.js"
      );
    const walkInController =
      await source(
        "../features/appointments/walkInController.js"
      );

    assert.match(
      routes,
      /"\/:id\/status"[\s\S]*?requireStatusPermission[\s\S]*?status/
    );
    assert.doesNotMatch(
      walkInController,
      /changeAppointmentStatus|recordStatusChange/
    );
  }
);
