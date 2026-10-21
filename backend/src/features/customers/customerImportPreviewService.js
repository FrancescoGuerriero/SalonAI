import crypto from "node:crypto";

const MAX_ROWS = 5000;
const MAX_FIELD_LENGTH = 3000;

function importError(message, code = "INVALID_CUSTOMER_IMPORT") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function compactText(value, maximum = MAX_FIELD_LENGTH) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}

function normaliseEmail(value) {
  return compactText(value, 254).toLowerCase();
}

function normalisePhone(value) {
  const raw = compactText(value, 50);
  if (!raw) return "";
  const hasLeadingPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return hasLeadingPlus && digits ? `+${digits}` : digits;
}

function csvRows(text) {
  const source = String(text ?? "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += character;
  }

  if (quoted) {
    throw importError("CSV contains an unterminated quoted field.");
  }

  row.push(field);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  return rows;
}

function canonicalHeader(value) {
  return compactText(value, 120)
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

function mappedHeaders(headerRow) {
  const seen = new Set();
  return headerRow.map((raw) => {
    const canonical = canonicalHeader(raw);
    const mapped = FIELD_ALIASES[canonical] || "";
    if (mapped && seen.has(mapped)) {
      throw importError(`CSV maps more than one column to ${mapped}.`);
    }
    if (mapped) seen.add(mapped);
    return mapped;
  });
}

function truthyConsent(value) {
  return ["true", "yes", "y", "1", "consent", "opt_in", "opt-in"].includes(
    compactText(value, 40).toLowerCase()
  );
}

function normaliseRow(raw = {}, rowNumber) {
  const firstName = compactText(raw.firstName, 50);
  const lastName = compactText(raw.lastName, 50);
  const email = normaliseEmail(raw.email);
  const phone = normalisePhone(raw.phone);
  const warnings = [];
  const errors = [];

  if (!firstName) errors.push("firstName is required");
  if (!lastName) errors.push("lastName is required");
  if (!email && !phone) warnings.push("no email or phone supplied");

  const sourceClaimsMarketingConsent =
    truthyConsent(raw.emailMarketingConsent) ||
    truthyConsent(raw.smsMarketingConsent) ||
    truthyConsent(raw.whatsappMarketingConsent);

  if (sourceClaimsMarketingConsent) {
    warnings.push(
      "source marketing-consent value was not imported; explicit SalonAI consent evidence is required"
    );
  }

  return {
    rowNumber,
    customer: {
      firstName,
      lastName,
      preferredName: compactText(raw.preferredName, 100),
      email,
      phone,
      notes: compactText(raw.notes, 3000),
      source: "import",
      communicationPreferences: {
        promotionalMessages: false,
        emailMarketing: false,
        smsMarketing: false,
        whatsappMarketing: false,
      },
      marketing: {
        emailConsent: false,
        smsConsent: false,
        whatsappConsent: false,
        consentSource: "",
      },
    },
    identifiers: Object.freeze({ email, phone }),
    sourceClaimsMarketingConsent,
    warnings,
    errors,
  };
}

function stableFingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export function parseCustomerImportCsv(csvText) {
  const rows = csvRows(csvText);
  if (rows.length < 2) {
    throw importError("Customer CSV must include a header row and at least one data row.");
  }
  if (rows.length - 1 > MAX_ROWS) {
    throw importError(`Customer import preview is limited to ${MAX_ROWS} rows.`);
  }

  const headers = mappedHeaders(rows[0]);
  if (!headers.includes("firstName") || !headers.includes("lastName")) {
    throw importError("Customer CSV must map first name and last name columns.");
  }

  return rows.slice(1).map((values, index) => {
    const raw = {};
    headers.forEach((header, columnIndex) => {
      if (header) raw[header] = values[columnIndex] ?? "";
    });
    return normaliseRow(raw, index + 2);
  });
}

export function buildCustomerImportPreview(
  inputRows = [],
  { existingCustomers = [], sourceName = "customer-import" } = {}
) {
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    throw importError("Customer import preview requires at least one staged row.");
  }
  if (inputRows.length > MAX_ROWS) {
    throw importError(`Customer import preview is limited to ${MAX_ROWS} rows.`);
  }

  const rows = inputRows.map((row, index) =>
    row?.customer && Number.isInteger(row?.rowNumber)
      ? { ...row, warnings: [...(row.warnings || [])], errors: [...(row.errors || [])] }
      : normaliseRow(row, index + 1)
  );

  const existingEmails = new Set(
    existingCustomers.map((customer) => normaliseEmail(customer?.email)).filter(Boolean)
  );
  const existingPhones = new Set(
    existingCustomers.map((customer) => normalisePhone(customer?.phone)).filter(Boolean)
  );
  const batchEmails = new Map();
  const batchPhones = new Map();

  for (const row of rows) {
    const email = row.identifiers?.email || "";
    const phone = row.identifiers?.phone || "";

    if (email) {
      if (existingEmails.has(email)) row.warnings.push("email matches an existing customer");
      if (batchEmails.has(email)) {
        row.errors.push(`email duplicates staged row ${batchEmails.get(email)}`);
      } else {
        batchEmails.set(email, row.rowNumber);
      }
    }

    if (phone) {
      if (existingPhones.has(phone)) row.warnings.push("phone matches an existing customer");
      if (batchPhones.has(phone)) {
        row.errors.push(`phone duplicates staged row ${batchPhones.get(phone)}`);
      } else {
        batchPhones.set(phone, row.rowNumber);
      }
    }
  }

  const canonicalRows = rows.map((row) => ({
    rowNumber: row.rowNumber,
    customer: row.customer,
    warnings: [...new Set(row.warnings)].sort(),
    errors: [...new Set(row.errors)].sort(),
  }));

  const fingerprint = stableFingerprint({
    schema: "salonai.customer-import-preview.v1",
    sourceName: compactText(sourceName, 200),
    rows: canonicalRows,
  });

  return Object.freeze({
    schema: "salonai.customer-import-preview.v1",
    sourceName: compactText(sourceName, 200),
    rowCount: canonicalRows.length,
    validRowCount: canonicalRows.filter((row) => row.errors.length === 0).length,
    errorRowCount: canonicalRows.filter((row) => row.errors.length > 0).length,
    warningRowCount: canonicalRows.filter((row) => row.warnings.length > 0).length,
    fingerprint,
    governance: Object.freeze({
      previewOnly: true,
      databaseWritesAllowed: false,
      administratorApprovalRequiredBeforeApply: true,
      tenantOwnershipMustBeResolvedAtApply: true,
      marketingConsentImported: false,
      trainingEligibilityInferred: false,
    }),
    rows: canonicalRows,
  });
}

export function previewCustomerImportCsv(csvText, options = {}) {
  return buildCustomerImportPreview(parseCustomerImportCsv(csvText), options);
}

export default {
  buildCustomerImportPreview,
  parseCustomerImportCsv,
  previewCustomerImportCsv,
};
