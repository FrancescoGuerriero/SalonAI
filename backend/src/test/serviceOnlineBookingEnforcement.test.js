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

test("customer appointment creation rejects services that are globally non-bookable", async () => {
  const controller =
    await source(
      "../controllers/appointmentController.js"
    );

  assert.match(
    controller,
    /isServiceBookable/
  );

  assert.match(
    controller,
    /service\?\.bookable/
  );

  assert.match(
    controller,
    /The selected service is not currently bookable\./
  );
});

test("public service card applies bookable across enabled booking channels", async () => {
  const card =
    await source(
      "../../../frontend/src/components/customer/ServiceCard.jsx"
    );

  assert.match(
    card,
    /service\.bookable\s*!==\s*false/
  );

  assert.match(
    card,
    /serviceBookable\s*&&[\s\S]*whatsappBookingEnabled/
  );

  assert.match(
    card,
    /serviceBookable\s*&&[\s\S]*onlineBookingEnabled/
  );

  assert.doesNotMatch(
    card,
    /service\.onlineBookable/
  );
});
