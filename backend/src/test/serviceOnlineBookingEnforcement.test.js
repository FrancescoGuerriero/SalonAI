import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test("customer appointment creation rejects services that are not bookable", async () => {
  const controller =
    await source(
      "../controllers/appointmentController.js"
    );

  assert.match(
    controller,
    /const serviceBookable/
  );
  assert.match(
    controller,
    /service\.bookable/
  );

  assert.match(
    controller,
    /The selected service is not available for booking\./
  );
});

test("public service card does not offer standard booking for non-bookable services", async () => {
  const card =
    await source(
      "../../../frontend/src/components/customer/ServiceCard.jsx"
    );

  assert.match(
    card,
    /service\.bookable\s*===\s*false/
  );

  assert.match(
    card,
    /showOnlineBookingAction/
  );

  assert.match(
    card,
    /!consultationOnly\s*&&\s*onlineBookingEnabled/
  );
});


test("service model separates active published and bookable state", async () => {
  const model =
    await source(
      "../models/service.js"
    );

  assert.match(
    model,
    /active:\s*\{/
  );
  assert.match(
    model,
    /published:\s*\{/
  );
  assert.match(
    model,
    /bookable:\s*\{/
  );
});

test("public service queries require active and published while retaining legacy migration safety", async () => {
  const controller =
    await source(
      "../controllers/serviceController.js"
    );

  assert.match(
    controller,
    /PUBLIC_SERVICE_FILTER/
  );
  assert.match(
    controller,
    /published:\s*true/
  );
  assert.match(
    controller,
    /\$exists:\s*false/
  );
  assert.match(
    controller,
    /serialiseService/
  );
});


test("management and catalogue sources no longer write the legacy onlineBookable field", async () => {
  const sources = await Promise.all([
    source(
      "../../../frontend/src/pages/ServicesPage.jsx"
    ),
    source(
      "../../../frontend/src/pages/AdminServices.jsx"
    ),
    source(
      "../../../frontend/src/components/customer/ServiceCard.jsx"
    ),
    source(
      "../../scripts/seedServiceCatalogue.js"
    ),
    source(
      "../../scripts/seedBookingCatalogue.js"
    ),
    source(
      "../../data/3thirty-services.json"
    ),
    source(
      "../../scripts/serviceCatalogue.francesco-p.json"
    ),
  ]);

  for (const value of sources) {
    assert.equal(
      value.includes(
        "onlineBookable"
      ),
      false
    );
  }
});


test("staff-managed appointment operations enforce global service bookability", async () => {
  const service =
    await source(
      "../features/appointments/appointmentManagementService.js"
    );

  assert.match(
    service,
    /function serviceIsGloballyBookable/
  );
  assert.match(
    service,
    /service\.bookable/
  );
  assert.match(
    service,
    /service\.onlineBookable/
  );
  assert.match(
    service,
    /async function appointmentEligibleService/
  );

  for (const operation of [
    "checkAppointmentConflict",
    "createManagedAppointment",
    "rescheduleAppointment",
  ]) {
    const start =
      service.indexOf(
        `async function ${operation}`
      );

    assert.ok(
      start >= 0,
      `Missing managed booking operation: ${operation}`
    );

    const next =
      service.indexOf(
        "\nasync function ",
        start + 20
      );

    const operationSource =
      service.slice(
        start,
        next >= 0
          ? next
          : service.length
      );

    assert.match(
      operationSource,
      /appointmentEligibleService\(/
    );
  }
});

test("WhatsApp booking prefers canonical service bookable state with legacy fallback", async () => {
  const orchestrator =
    await source(
      "../features/premium/whatsapp/whatsappBotOrchestrator.js"
    );

  const start =
    orchestrator.indexOf(
      "function serviceNeedsManualBooking"
    );
  const end =
    orchestrator.indexOf(
      "\nfunction ",
      start + 20
    );
  const helper =
    orchestrator.slice(
      start,
      end >= 0
        ? end
        : orchestrator.length
    );

  assert.match(
    helper,
    /service\.bookable/
  );
  assert.match(
    helper,
    /service\.onlineBookable/
  );
  assert.match(
    helper,
    /bookable === false/
  );
});
