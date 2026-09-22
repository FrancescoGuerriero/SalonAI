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
  "waitlist conversion delegates booking writes to canonical appointment management",
  async () => {
    const waitlist =
      await source(
        "../features/waitlist/waitlistService.js"
      );

    assert.match(
      waitlist,
      /createManagedAppointment,[\s\S]*?getManagedAppointment,[\s\S]*?appointmentManagementService\.js/
    );
    assert.doesNotMatch(
      waitlist,
      /import Appointment from/
    );
    assert.doesNotMatch(
      waitlist,
      /ACTIVE_APPOINTMENT_STATUSES/
    );
    assert.doesNotMatch(
      waitlist,
      /function findAppointmentConflict/
    );

    const start =
      waitlist.indexOf(
        "export async function convertToAppointment"
      );
    const end =
      waitlist.indexOf(
        "export async function deleteEntry",
        start
      );
    const handler =
      waitlist.slice(
        start,
        end
      );

    assert.match(
      handler,
      /session\.withTransaction/
    );
    assert.match(
      handler,
      /createManagedAppointment\(/
    );
    assert.match(
      handler,
      /session,[\s\S]*?bookingSource:[\s\S]*?"management"[\s\S]*?returnPopulated:[\s\S]*?false/
    );
    assert.match(
      handler,
      /getManagedAppointment\(/
    );
    assert.doesNotMatch(
      handler,
      /Appointment\.create\(/
    );
    assert.doesNotMatch(
      handler,
      /findAppointmentConflict\(/
    );
    assert.doesNotMatch(
      handler,
      /loadRelatedRecords\(/
    );
  }
);

test(
  "canonical managed appointment creation accepts a transaction session without changing ordinary callers",
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
        "Calendar and appointment retrieval",
        start
      );
    const handler =
      service.slice(
        start,
        end
      );

    assert.match(
      handler,
      /session = null/
    );
    assert.match(
      handler,
      /bookingSource =[\s\S]*?"management"/
    );
    assert.match(
      handler,
      /returnPopulated =[\s\S]*?true/
    );
    assert.match(
      handler,
      /appointmentEligibleService\([\s\S]*?session/
    );
    assert.match(
      handler,
      /appointmentEligibleStylist\([\s\S]*?session/
    );
    assert.match(
      handler,
      /assertAppointmentWithinStaffAvailability\(/
    );
    assert.match(
      handler,
      /findConflict\(\{[\s\S]*?session/
    );
    assert.match(
      handler,
      /Appointment\.create\([\s\S]*?appointmentPayload[\s\S]*?session/
    );
    assert.match(
      handler,
      /customer\.save\([\s\S]*?session/
    );
    assert.match(
      handler,
      /returnPopulated ===[\s\S]*?false[\s\S]*?return appointment/
    );
  }
);

test(
  "transaction session reads are sequential while ordinary canonical creation keeps parallel resource loading",
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
        "const window =",
        start
      );
    const resources =
      service.slice(
        start,
        end
      );

    assert.match(
      resources,
      /if \(session\)[\s\S]*?customer =[\s\S]*?await customerQuery[\s\S]*?service =[\s\S]*?await appointmentEligibleService/
    );
    assert.match(
      resources,
      /else \{[\s\S]*?Promise\.all/
    );
  }
);

test(
  "canonical conflict detection can participate in a transaction",
  async () => {
    const service =
      await source(
        "../features/appointments/appointmentManagementService.js"
      );

    const start =
      service.indexOf(
        "async function findConflict"
      );
    const end =
      service.indexOf(
        "function serviceIsGloballyBookable",
        start
      );
    const conflict =
      service.slice(
        start,
        end
      );

    assert.match(
      conflict,
      /session = null/
    );
    assert.match(
      conflict,
      /candidateQuery\.session\([\s\S]*?session/
    );
    assert.match(
      conflict,
      /appointmentDate:[\s\S]*?conflictDayStart[\s\S]*?conflictDayEnd/
    );
  }
);

test(
  "waitlist conversion preserves waitlist-specific preference and state rules",
  async () => {
    const waitlist =
      await source(
        "../features/waitlist/waitlistService.js"
      );

    const start =
      waitlist.indexOf(
        "export async function convertToAppointment"
      );
    const end =
      waitlist.indexOf(
        "export async function deleteEntry",
        start
      );
    const handler =
      waitlist.slice(
        start,
        end
      );

    assert.match(
      handler,
      /evaluateSlot\(/
    );
    assert.match(
      handler,
      /payload\.force/
    );
    assert.match(
      handler,
      /CONVERTIBLE_WAITLIST_STATUSES/
    );
    assert.match(
      handler,
      /entry\.changeStatus\([\s\S]*?"booked"/
    );
    assert.match(
      handler,
      /entry\.convertedAppointment/
    );
  }
);
