import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import {
  parseCustomerImportXlsx,
  previewCustomerImportXlsx,
} from "../features/customers/customerImportXlsxPreviewService.js";

async function workbookBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Customers");
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("XLSX customer import stages first worksheet rows through the governed preview contract", async () => {
  const buffer = await workbookBuffer([
    ["First Name", "Last Name", "Email", "Mobile", "WhatsApp Marketing Consent"],
    ["Dorothy", "Vaughan", "DOROTHY@example.com", "+44 7700 900777", "yes"],
  ]);

  const staged = await parseCustomerImportXlsx(buffer);
  assert.deepEqual(staged, [
    {
      firstName: "Dorothy",
      lastName: "Vaughan",
      email: "DOROTHY@example.com",
      phone: "+44 7700 900777",
      whatsappMarketingConsent: "yes",
    },
  ]);

  const preview = await previewCustomerImportXlsx(buffer, {
    sourceName: "legacy-clients.xlsx",
  });

  assert.equal(preview.rowCount, 1);
  assert.equal(preview.rows[0].customer.email, "dorothy@example.com");
  assert.equal(preview.rows[0].customer.phone, "+447700900777");
  assert.equal(preview.rows[0].customer.marketing.whatsappConsent, false);
  assert.equal(preview.governance.databaseWritesAllowed, false);
  assert.equal(preview.governance.marketingConsentImported, false);
  assert.match(preview.rows[0].warnings.join(" "), /explicit SalonAI consent evidence/i);
});

test("XLSX customer import stages Date cells and historical service labels as unresolved evidence", async () => {
  const appointmentDate = new Date("2025-11-08T13:45:00Z");
  const buffer = await workbookBuffer([
    ["First Name", "Last Name", "Email", "Last Service", "Last Appointment Date"],
    ["Mae", "Jemison", "mae@example.com", "Balayage", appointmentDate],
  ]);

  const preview = await previewCustomerImportXlsx(buffer, {
    sourceName: "legacy-history.xlsx",
  });

  assert.equal(preview.rows[0].historical.serviceName, "Balayage");
  assert.equal(preview.rows[0].historical.appointmentAt, appointmentDate.toISOString());
  assert.equal(preview.rows[0].historical.canonicalServiceId, "");
  assert.equal(preview.rows[0].historical.canonicalAppointmentId, "");
  assert.equal(preview.governance.historicalMappingRequiresCanonicalResolution, true);
});

test("XLSX customer import rejects missing identity headers and empty workbooks", async () => {
  const missingNames = await workbookBuffer([
    ["Email", "Phone"],
    ["client@example.com", "07700900111"],
  ]);

  await assert.rejects(
    () => parseCustomerImportXlsx(missingNames),
    (error) => error?.code === "INVALID_CUSTOMER_IMPORT"
  );

  const empty = new ExcelJS.Workbook();
  const emptyBuffer = Buffer.from(await empty.xlsx.writeBuffer());
  await assert.rejects(
    () => parseCustomerImportXlsx(emptyBuffer),
    (error) => error?.code === "INVALID_CUSTOMER_IMPORT"
  );
});
