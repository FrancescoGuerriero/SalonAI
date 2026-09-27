import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(
    new URL(path, import.meta.url),
    "utf8"
  );
}

test(
  "WhatsApp final confirmation uses canonical appointment creation authority",
  async () => {
    const controller =
      await source(
        "../features/premium/whatsapp/whatsappController.js"
      );

    const start =
      controller.indexOf(
        "export async function confirmBooking"
      );
    const end =
      controller.indexOf(
        "export async function sendConversationMessage",
        start
      );
    const confirmation =
      controller.slice(
        start,
        end
      );

    assert.ok(
      start >= 0 &&
      end > start,
      "WhatsApp confirmBooking source must be present"
    );

    assert.match(
      controller,
      /createManagedAppointment/
    );
    assert.match(
      confirmation,
      /await\s+createManagedAppointment\(/
    );
    assert.match(
      confirmation,
      /bookingSource:\s*"whatsapp"/
    );
    assert.match(
      confirmation,
      /externalBookingReference/
    );
    assert.match(
      confirmation,
      /Appointment\.findOne\(\{\s*externalBookingReference/
    );
    assert.doesNotMatch(
      confirmation,
      /Appointment\.create\(/
    );
    assert.doesNotMatch(
      confirmation,
      /customer\.nextAppointment\s*=/
    );
  }
);

test(
  "canonical appointment service owns trusted external booking references",
  async () => {
    const service =
      await source(
        "../features/appointments/appointmentManagementService.js"
      );

    const start =
      service.indexOf(
        "async function createManagedAppointment"
      );
    const end =
      service.indexOf(
        "| Calendar and appointment retrieval",
        start
      );
    const creation =
      service.slice(
        start,
        end
      );

    assert.match(
      creation,
      /externalBookingReference\s*=\s*""/
    );
    assert.match(
      creation,
      /externalBookingReference:\s*normaliseText\(/
    );
    assert.match(
      creation,
      /bookingSource:\s*normaliseText\(/
    );
  }
);
