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
  "walk-in and call-ahead creation reuse the canonical appointment creator",
  async () => {
    const service =
      await source(
        "../features/appointments/walkInService.js"
      );

    assert.match(
      service,
      /createManagedAppointment/
    );
    assert.match(
      service,
      /async function createQueueAppointment/
    );
    assert.match(
      service,
      /status:\s*"pending"/
    );
    assert.match(
      service,
      /queueSource ===[\s\S]*?"walk_in"[\s\S]*?"walk_in"[\s\S]*?"phone"/
    );
    assert.match(
      service,
      /createQueueVisitForAppointment/
    );
    assert.doesNotMatch(
      service,
      /Appointment\.create\(/
    );
  }
);

test(
  "QueueVisit persists queue metadata without duplicating the appointment lifecycle",
  async () => {
    const model =
      await source(
        "../features/appointments/QueueVisit.js"
      );

    assert.match(
      model,
      /QUEUE_VISIT_SOURCES/
    );
    assert.match(
      model,
      /"walk_in"/
    );
    assert.match(
      model,
      /"call_ahead"/
    );
    assert.match(
      model,
      /ref:\s*"Appointment"/
    );
    assert.match(
      model,
      /unique:\s*true/
    );
    assert.match(
      model,
      /expectedArrivalAt/
    );
    assert.match(
      model,
      /priority/
    );
    assert.doesNotMatch(
      model,
      /checkedInAt|startedAt|completedAt|cancelledAt|noShowAt/
    );
  }
);

test(
  "queue state is derived from canonical appointment status",
  async () => {
    const service =
      await source(
        "../features/appointments/queueVisitService.js"
      );

    assert.match(
      service,
      /case "confirmed":[\s\S]*?return "assigned"/
    );
    assert.match(
      service,
      /case "checked_in":[\s\S]*?return "checked_in"/
    );
    assert.match(
      service,
      /case "in_progress":[\s\S]*?return "in_service"/
    );
    assert.match(
      service,
      /case "completed":[\s\S]*?return "completed"/
    );
    assert.match(
      service,
      /case "cancelled":[\s\S]*?return "cancelled"/
    );
    assert.match(
      service,
      /case "no_show":[\s\S]*?return "no_show"/
    );
    assert.match(
      service,
      /case "pending":[\s\S]*?return "waiting"/
    );
  }
);

test(
  "queue listing preserves legacy walk-ins and adds queue metrics",
  async () => {
    const service =
      await source(
        "../features/appointments/queueVisitService.js"
      );

    assert.match(
      service,
      /QueueVisit\.find\(/
    );
    assert.match(
      service,
      /Appointment\.find\(\{[\s\S]*?bookingSource:[\s\S]*?"walk_in"/
    );
    assert.match(
      service,
      /averageWaitMinutes/
    );
    assert.match(
      service,
      /longestWaitMinutes/
    );
    assert.match(
      service,
      /arrivalVarianceMinutes/
    );
    assert.match(
      service,
      /serviceDelayMinutes/
    );
    assert.match(
      service,
      /visitMinutes/
    );
  }
);

test(
  "walk-in compatibility route and generic queue routes share appointment permissions",
  async () => {
    const routes =
      await source(
        "../features/appointments/appointmentManagementRoutes.js"
      );

    const queueVisits =
      routes.indexOf(
        '"/queue-visits"'
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
      queueVisits >= 0
    );
    assert.ok(
      walkIns > queueVisits
    );
    assert.ok(
      individual > walkIns,
      "queue routes must be registered before the appointment identifier route"
    );

    assert.match(
      routes,
      /"\/queue-visits"[\s\S]*?"appointment:read"[\s\S]*?queueVisits/
    );
    assert.match(
      routes,
      /"\/queue-visits"[\s\S]*?"appointment:create"[\s\S]*?appointmentLifecycleNotification\([\s\S]*?"created"[\s\S]*?createQueueVisit/
    );
    assert.match(
      routes,
      /"\/walk-ins"[\s\S]*?"appointment:read"[\s\S]*?walkInQueue/
    );
    assert.match(
      routes,
      /"\/walk-ins"[\s\S]*?"appointment:create"[\s\S]*?createWalkIn/
    );
    assert.doesNotMatch(
      routes,
      /queue:read|queue:create|front_desk:create/
    );
  }
);

test(
  "frontend appointment API exposes generic queue operations without removing walk-in compatibility",
  async () => {
    const frontend =
      await source(
        "../../../frontend/src/Services/appointmentManagementApi.js"
      );

    assert.match(
      frontend,
      /createQueueVisit/
    );
    assert.match(
      frontend,
      /getQueueVisits/
    );
    assert.match(
      frontend,
      /`?\$\{BASE_URL\}\/queue-visits`?/
    );
    assert.match(
      frontend,
      /createWalkInAppointment/
    );
    assert.match(
      frontend,
      /getWalkInQueue/
    );
  }
);
