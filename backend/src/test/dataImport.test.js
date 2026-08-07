import assert from "node:assert/strict";
import test from "node:test";

import DataImportJob from "../features/dataImport/DataImportJob.js";
import {
  CUSTOMER_IMPORT_COLUMNS,
  MAXIMUM_IMPORT_ROWS,
  PRODUCT_IMPORT_COLUMNS,
  normaliseCustomerImportRow,
  normaliseProductImportRow,
} from "../features/dataImport/dataImportService.js";

test("customer import normalisation is conservative with marketing consent", () => {
  const row = normaliseCustomerImportRow({
    firstName: "  Anna ",
    lastName: " Smith ",
    email: " ANNA@EXAMPLE.COM ",
    phone: " 07123 456789 ",
    dateOfBirth: "1990-06-15",
    postcode: " e1 1aa ",
    tags: "colour|regular|colour",
  });

  assert.equal(row.data.firstName, "Anna");
  assert.equal(row.data.email, "anna@example.com");
  assert.equal(row.data.address.postcode, "E1 1AA");
  assert.deepEqual(row.data.tags, ["colour", "regular"]);
  assert.equal(row.data.source, "import");
  assert.equal(row.data.marketing.emailConsent, false);
  assert.equal(row.data.marketing.smsConsent, false);
  assert.equal(row.data.communicationPreferences.unsubscribed, true);
});

test("customer import requires a contact method and explicit consent values", () => {
  assert.throws(
    () => normaliseCustomerImportRow({ firstName: "Anna", lastName: "Smith" }),
    /contact method/
  );
  assert.throws(
    () =>
      normaliseCustomerImportRow({
        firstName: "Anna",
        lastName: "Smith",
        email: "anna@example.com",
        emailConsent: "sometimes",
      }),
    /yes or no/
  );
});

test("product import normalises catalogue, price and opening stock fields", () => {
  const row = normaliseProductImportRow({
    name: " Hydrating Shampoo ",
    sku: " hair-001 ",
    price: "18.50",
    costPrice: "7.25",
    stockQuantity: "12",
    reorderLevel: "4",
    featured: "yes",
    active: "true",
    imageUrl: "https://example.com/shampoo.jpg",
  });

  assert.equal(row.data.name, "Hydrating Shampoo");
  assert.equal(row.data.sku, "HAIR-001");
  assert.equal(row.data.price, 18.5);
  assert.equal(row.data.stockQuantity, 12);
  assert.equal(row.data.featured, true);
  assert.deepEqual(row.data.images, ["https://example.com/shampoo.jpg"]);
});

test("product import safely normalises names with repeated separators", () => {
  const row = normaliseProductImportRow({
    name: `${"-".repeat(40)}Hydrating Shampoo${"-".repeat(40)}`,
    sku: "HAIR-002",
    price: "18.50",
  });

  assert.equal(row.data.sku, "HAIR-002");
});

test("product import rejects negative, fractional stock and insecure images", () => {
  assert.throws(
    () =>
      normaliseProductImportRow({
        name: "Shampoo",
        sku: "SH-1",
        price: "10",
        stockQuantity: "2.5",
      }),
    /whole number/
  );
  assert.throws(
    () =>
      normaliseProductImportRow({
        name: "Shampoo",
        sku: "SH-1",
        price: "10",
        imageUrl: "http://example.com/shampoo.jpg",
      }),
    /HTTPS/
  );
});

test("import templates and audit schema expose the controlled workflow", () => {
  assert.ok(CUSTOMER_IMPORT_COLUMNS.includes("emailConsent"));
  assert.ok(PRODUCT_IMPORT_COLUMNS.includes("stockQuantity"));
  assert.equal(MAXIMUM_IMPORT_ROWS, 500);
  assert.ok(DataImportJob.schema.paths.fileHash);
  assert.ok(DataImportJob.schema.paths.requestedBy);
  assert.ok(DataImportJob.schema.path("summary").schema.path("failed"));
});
