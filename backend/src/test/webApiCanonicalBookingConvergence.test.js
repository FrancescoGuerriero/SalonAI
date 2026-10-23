import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "customer web and API booking delegates appointment creation to the canonical engine",
  async () => {
    const route = await source(
      "../routes/appointmentRoutes.js"
    );
    const controller = await source(
      "../features/appointments/customerBookingController.js"
    );

    assert.match(
      route,
      /customerBookingController\.js/
    );
    assert.match(
      route,
      /createCustomerAppointment/
    );

    const start = controller.indexOf(
      "export async function createCustomerAppointment"
    );
    const end = controller.indexOf(
      "\nexport default",
      start
    );
    const creation = controller.slice(
      start,
      end >= 0 ? end : controller.length
    );

    assert.match(
      creation,
      /createManagedAppointment\(/
    );
    assert.match(
      creation,
      /bookingSource:\s*"website"/
    );
    assert.match(
      creation,
      /returnPopulated:\s*false/
    );
    assert.doesNotMatch(
      creation,
      /Appointment\.create\(/
    );
  }
);
