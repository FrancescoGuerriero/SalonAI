import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerImportPreview,
  parseCustomerImportCsv,
  previewCustomerImportCsv,
} from "../features/customers/customerImportPreviewService.js";

test("customer import CSV normalises supported fields and fails marketing consent closed", () => {
  const rows = parseCustomerImportCsv(
    [
      "first_name,last_name,email,mobile,email_marketing_consent,notes",
      ' Ada , Lovelace , ADA@EXAMPLE.COM , "+44 7700 900123" , yes , "Imported, legacy client"',
    ].join("\n")
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].customer.firstName, "Ada");
  assert.equal(rows[0].customer.lastName, "Lovelace");
  assert.equal(rows[0].customer.email, "ada@example.com");
  assert.equal(rows[0].customer.phone, "+447700900123");
  assert.equal(rows[0].customer.notes, "Imported, legacy client");
  assert.equal(rows[0].customer.source, "import");
  assert.equal(rows[0].customer.marketing.emailConsent, false);
  assert.equal(rows[0].customer.communicationPreferences.emailMarketing, false);
  assert.equal(rows[0].sourceClaimsMarketingConsent, true);
  assert.match(rows[0].warnings.join(" "), /explicit SalonAI consent evidence/i);
});

test("customer import preview stages historical service and appointment evidence without creating canonical records", () => {
  const preview = previewCustomerImportCsv(
    [
      "first_name,last_name,email,last_service,last_appointment_date",
      "Annie,Easley,annie@example.com,Full Colour,2026-01-12T10:30:00Z",
    ].join("\n"),
    { sourceName: "legacy-history.csv" }
  );

  assert.equal(preview.rows[0].historical.serviceName, "Full Colour");
  assert.equal(preview.rows[0].historical.appointmentAt, "2026-01-12T10:30:00.000Z");
  assert.equal(preview.rows[0].historical.canonicalServiceId, "");
  assert.equal(preview.rows[0].historical.canonicalAppointmentId, "");
  assert.equal(preview.governance.historicalMappingRequiresCanonicalResolution, true);
  assert.match(preview.rows[0].warnings.join(" "), /canonical Service\/Appointment resolution/i);
});

test("customer import preview rejects invalid historical appointment dates", () => {
  const preview = previewCustomerImportCsv(
    [
      "first_name,last_name,email,historical_service,historical_appointment_date",
      "Mary,Jackson,mary@example.com,Highlights,not-a-date",
    ].join("\n")
  );

  assert.equal(preview.errorRowCount, 1);
  assert.match(preview.rows[0].errors.join(" "), /historical appointment date is invalid/i);
});

test("customer import preview detects staged and existing-customer collisions without writing", () => {
  const preview = previewCustomerImportCsv(
    [
      "first_name,last_name,email,phone",
      "Grace,Hopper,grace@example.com,+44 7700 900001",
      "Grace,Duplicate,GRACE@example.com,+44 7700 900002",
      "Existing,Client,existing@example.com,+44 7700 900003",
    ].join("\n"),
    {
      sourceName: "legacy-salon.csv",
      existingCustomers: [
        { email: "existing@example.com", phone: "+447700900099" },
      ],
    }
  );

  assert.equal(preview.schema, "salonai.customer-import-preview.v1");
  assert.equal(preview.rowCount, 3);
  assert.equal(preview.errorRowCount, 1);
  assert.equal(preview.validRowCount, 2);
  assert.equal(preview.governance.previewOnly, true);
  assert.equal(preview.governance.databaseWritesAllowed, false);
  assert.equal(preview.governance.administratorApprovalRequiredBeforeApply, true);
  assert.equal(preview.governance.marketingConsentImported, false);
  assert.equal(preview.governance.trainingEligibilityInferred, false);
  assert.match(preview.rows[1].errors.join(" "), /duplicates staged row 2/i);
  assert.match(preview.rows[2].warnings.join(" "), /existing customer/i);
  assert.match(preview.fingerprint, /^[a-f0-9]{64}$/);
});

test("customer import preview fingerprint is deterministic for the same staged data", () => {
  const input = [
    {
      firstName: "Katherine",
      lastName: "Johnson",
      email: "katherine@example.com",
      phone: "07700900444",
    },
  ];

  const first = buildCustomerImportPreview(input, { sourceName: "customers.xlsx" });
  const second = buildCustomerImportPreview(input, { sourceName: "customers.xlsx" });

  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.rows, second.rows);
});

test("customer import CSV rejects malformed or insufficient files", () => {
  assert.throws(
    () => parseCustomerImportCsv("first_name,last_name\n"),
    (error) => error?.code === "INVALID_CUSTOMER_IMPORT"
  );

  assert.throws(
    () => parseCustomerImportCsv('first_name,last_name\n"Ada,Lovelace'),
    (error) => error?.code === "INVALID_CUSTOMER_IMPORT"
  );

  assert.throws(
    () => parseCustomerImportCsv("email,phone\na@example.com,07700"),
    (error) => error?.code === "INVALID_CUSTOMER_IMPORT"
  );
});
