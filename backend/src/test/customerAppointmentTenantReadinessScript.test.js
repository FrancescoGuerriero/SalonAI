import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCustomerAppointmentReadOnlyArguments,
  sanitiseCustomerAppointmentReadiness,
} from "../../scripts/checkCustomerAppointmentTenantReadiness.js";

test("Customer/Appointment readiness CLI rejects every write-like argument", () => {
  for (
    const argument of [
      "--apply",
      "--apply=true",
      "--write",
      "--write=yes",
      "--migrate",
      "--backfill",
      "--fix",
    ]
  ) {
    assert.throws(
      () =>
        assertCustomerAppointmentReadOnlyArguments([
          argument,
        ]),
      /read-only/
    );
  }

  assert.equal(
    assertCustomerAppointmentReadOnlyArguments(
      []
    ),
    true
  );
});

test("Customer/Appointment readiness report exposes counts and blocker classes without identifiers or PII", () => {
  const report =
    sanitiseCustomerAppointmentReadiness({
      readiness: {
        safeForBackfill:
          false,
        scope: {
          businessCount:
            1,
          canonicalBusinessCount:
            1,
          otherBusinessCount:
            0,
          activeBusinessLocationCount:
            2,
          canonicalLocationCount:
            1,
          safeForGlobalCustomerBackfill:
            true,
          safeForGlobalAppointmentBackfill:
            false,
          customerBlockers:
            [],
          appointmentBlockers: [
            "global-appointment-scope-not-single-location",
          ],
        },
        summary: {
          customers:
            30,
          customerBusinessAssignments:
            30,
          appointments:
            100,
          appointmentBusinessAssignments:
            0,
          appointmentLocationAssignments:
            0,
          blockers:
            1,
        },
        blockers: [
          {
            resourceType:
              "appointment",
            resourceId:
              "sensitive-record-id",
            blocker:
              "appointment-location-unproven",
          },
        ],
      },
      customerCoverage: {
        total:
          30,
        businessScoped:
          0,
      },
      appointmentCoverage: {
        total:
          100,
        businessScoped:
          0,
        locationScoped:
          0,
      },
      customerIndexes: [
        {
          name:
            "_id_",
        },
        {
          name:
            "email_1",
        },
        {
          name:
            "phone_1",
        },
        {
          name:
            "userAccount_1",
        },
      ],
      appointmentIndexes: [
        {
          name:
            "_id_",
        },
        {
          name:
            "invoiceNumber_1",
        },
        {
          name:
            "externalBookingReference_1",
        },
      ],
    });

  assert.equal(
    report.readOnly,
    true
  );
  assert.equal(
    report.databaseWrites,
    false
  );
  assert.equal(
    report.piiIncluded,
    false
  );
  assert.equal(
    report.identifiersIncluded,
    false
  );
  assert.equal(
    report.summary.blockerTypes[
      "appointment-location-unproven"
    ],
    1
  );
  assert.deepEqual(
    report.legacyUniqueIndexes.customers,
    [
      "email_1",
      "phone_1",
      "userAccount_1",
    ]
  );
  assert.deepEqual(
    report.legacyUniqueIndexes.appointments,
    [
      "externalBookingReference_1",
      "invoiceNumber_1",
    ]
  );

  const text =
    JSON.stringify(
      report
    );

  assert.doesNotMatch(
    text,
    /sensitive-record-id/
  );
  assert.doesNotMatch(
    text,
    /@/
  );
});
