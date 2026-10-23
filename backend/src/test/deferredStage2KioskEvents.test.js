import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DOMAIN_EVENT_CATALOGUE,
} from "../features/integrationPlatform/domainEventCatalogue.js";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("canonical event catalogue exposes front-desk queue lifecycle schemas", () => {
  for (const type of [
    "queue.visit_created",
    "queue.checked_in",
    "queue.state_changed",
  ]) {
    assert.deepEqual(
      DOMAIN_EVENT_CATALOGUE[type]?.versions,
      ["1"]
    );
  }
});

test("front-desk queue creation emits a tenant-owned canonical event", async () => {
  const service = await source(
    "../features/appointments/walkInService.js"
  );

  assert.match(service, /recordDomainEvent/);
  assert.match(service, /type:\s*"queue\.visit_created"/);
  assert.match(service, /aggregateType:\s*"queue_visit"/);
  assert.match(service, /businessId/);
  assert.match(service, /appointmentId/);
  assert.match(service, /locationId/);
  assert.match(service, /queueVisitId/);
  assert.doesNotMatch(service, /customerEmail|customerPhone/);
});

test("customer check-in publishes canonical appointment status evidence", async () => {
  const service = await source(
    "../features/customerExperience/stage4CustomerExperienceService.js"
  );

  assert.match(
    service,
    /changeAppointmentStatus[\s\S]*?recordDomainEvent/
  );
  assert.match(
    service,
    /type:\s*"appointment\.status_changed"/
  );
  assert.match(
    service,
    /previousStatus:\s*status/
  );
  assert.match(
    service,
    /status:\s*"checked_in"/
  );
  assert.match(
    service,
    /channel:\s*"customer_self_service"/
  );
});
