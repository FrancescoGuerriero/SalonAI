import ExcelJS from "exceljs";

import { buildCustomerImportPreview } from "./customerImportPreviewService.js";

const MAX_ROWS = 5000;

function importError(message, code = "INVALID_CUSTOMER_IMPORT") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function canonicalHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const FIELD_ALIASES = Object.freeze({
  first_name: "firstName",
  firstname: "firstName",
  first: "firstName",
  last_name: "lastName",
  lastname: "lastName",
  surname: "lastName",
  email: "email",
  email_address: "email",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  preferred_name: "preferredName",
  preferredname: "preferredName",
  notes: "notes",
  marketing_email_consent: "emailMarketingConsent",
  email_marketing_consent: "emailMarketingConsent",
  marketing_sms_consent: "smsMarketingConsent",
  sms_marketing_consent: "smsMarketingConsent",
  marketing_whatsapp_consent: "whatsappMarketingConsent",
  whatsapp_marketing_consent: "whatsappMarketingConsent",
});

function cellText(cell) {
  if (!cell) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item?.text || "").join("");
    }
  }
  return String(value);
}

function mappedHeaders(worksheet) {
  const headerRow = worksheet.getRow(1);
  const headers = [];
  const seen = new Set();

  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const canonical = canonicalHeader(cellText(headerRow.getCell(column)));
    const mapped = FIELD_ALIASES[canonical] || "";
    if (mapped && seen.has(mapped)) {
      throw importError(`XLSX maps more than one column to ${mapped}.`);
    }
    if (mapped) seen.add(mapped);
    headers[column] = mapped;
  }

  if (!headers.includes("firstName") || !headers.includes("lastName")) {
    throw importError("Customer XLSX must map first name and last name columns.");
  }
  return headers;
}

export async function parseCustomerImportXlsx(buffer) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw importError("Customer XLSX input must be a workbook buffer.");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw importError("Customer XLSX could not be parsed.");
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw importError("Customer XLSX must contain at least one worksheet.");
  }

  const headers = mappedHeaders(worksheet);
  const stagedRows = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const staged = {};
    let hasValue = false;

    for (let column = 1; column < headers.length; column += 1) {
      const field = headers[column];
      if (!field) continue;
      const value = cellText(row.getCell(column)).trim();
      if (value) hasValue = true;
      staged[field] = value;
    }

    if (hasValue) stagedRows.push(staged);
    if (stagedRows.length > MAX_ROWS) {
      throw importError(`Customer import preview is limited to ${MAX_ROWS} rows.`);
    }
  }

  if (stagedRows.length === 0) {
    throw importError("Customer XLSX must include at least one data row.");
  }

  return stagedRows;
}

export async function previewCustomerImportXlsx(buffer, options = {}) {
  const rows = await parseCustomerImportXlsx(buffer);
  return buildCustomerImportPreview(rows, options);
}

export default {
  parseCustomerImportXlsx,
  previewCustomerImportXlsx,
};
