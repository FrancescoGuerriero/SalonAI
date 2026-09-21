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
  "customer booking enforces canonical service bookability",
  async () => {
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
      /service\.onlineBookable/
    );
    assert.match(
      controller,
      /The selected service is not available for booking\./
    );
  }
);

test(
  "staff-managed booking enforces global service bookability",
  async () => {
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

    for (
      const operation
      of [
        "checkAppointmentConflict",
        "createManagedAppointment",
        "rescheduleAppointment",
      ]
    ) {
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
  }
);

test(
  "WhatsApp booking prefers canonical service bookability with legacy fallback",
  async () => {
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
  }
);

test(
  "service model keeps active published and bookable independent",
  async () => {
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
  }
);
