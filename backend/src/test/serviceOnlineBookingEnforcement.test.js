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

test("customer appointment creation rejects services that are not online bookable", async () => {
  const controller =
    await source(
      "../controllers/appointmentController.js"
    );

  assert.match(
    controller,
    /service\.onlineBookable\s*===\s*false/
  );

  assert.match(
    controller,
    /The selected service is not available for online booking\./
  );
});

test("public service card does not offer standard booking for non-bookable services", async () => {
  const card =
    await source(
      "../../../frontend/src/components/customer/ServiceCard.jsx"
    );

  assert.match(
    card,
    /service\.onlineBookable\s*===\s*false/
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
