import crypto from "node:crypto";

import Customer from "../../models/customer.js";
import Product from "../commerce/Product.js";
import InventoryAdjustment from "../commerce/InventoryAdjustment.js";
import {
  createCustomerProfile,
  updateCustomerProfile,
} from "../../services/customerProfileService.js";
import {
  createProduct,
  updateProduct,
} from "../commerce/commerceService.js";
import DataImportJob from "./DataImportJob.js";

export const MAXIMUM_IMPORT_ROWS = 500;
export const IMPORT_TYPES = ["customers", "products"];
export const DUPLICATE_POLICIES = ["skip", "update"];

export const CUSTOMER_IMPORT_COLUMNS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "title",
  "preferredName",
  "dateOfBirth",
  "gender",
  "addressLine1",
  "addressLine2",
  "city",
  "county",
  "postcode",
  "country",
  "preferredChannel",
  "emailConsent",
  "smsConsent",
  "status",
  "tags",
  "notes",
];

export const PRODUCT_IMPORT_COLUMNS = [
  "name",
  "sku",
  "brand",
  "category",
  "size",
  "description",
  "price",
  "costPrice",
  "stockQuantity",
  "reorderLevel",
  "imageUrl",
  "featured",
  "active",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUSTOMER_TITLES = new Set(["", "Mr", "Mrs", "Miss", "Ms", "Mx", "Dr", "Other"]);
const CUSTOMER_GENDERS = new Set([
  "male",
  "female",
  "non_binary",
  "other",
  "prefer_not_to_say",
]);
const CUSTOMER_STATUSES = new Set(["active", "inactive", "archived"]);
const COMMUNICATION_CHANNELS = new Set([
  "email",
  "sms",
  "phone",
  "whatsapp",
  "none",
]);

class ImportRowError extends Error {
  constructor(message, { code = "INVALID_IMPORT_ROW", field = null } = {}) {
    super(message);
    this.name = "ImportRowError";
    this.code = code;
    this.field = field;
  }
}

function normaliseText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normaliseMultilineText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

function normaliseEmail(value) {
  return normaliseText(value).toLowerCase();
}

function canonicalPhone(value) {
  return normaliseText(value).replace(/[^\d+]/g, "");
}

function rowError(message, field, code = "INVALID_IMPORT_VALUE") {
  throw new ImportRowError(message, { code, field });
}

function parseBoolean(value, { fallback = false, field = "value" } = {}) {
  if (value === undefined || value === null || normaliseText(value) === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalised = normaliseText(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalised)) return true;
  if (["false", "0", "no", "n"].includes(normalised)) return false;

  return rowError(`${field} must be yes or no.`, field);
}

function parseNonNegativeNumber(
  value,
  { field, required = false, fallback = 0, integer = false } = {}
) {
  const supplied = normaliseText(value);
  if (!supplied) {
    if (required) rowError(`${field} is required.`, field, "IMPORT_FIELD_REQUIRED");
    return fallback;
  }

  const parsed = Number(supplied);
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    rowError(
      `${field} must be a non-negative${integer ? " whole" : ""} number.`,
      field
    );
  }

  return parsed;
}

function parseIsoDate(value, field) {
  const supplied = normaliseText(value);
  if (!supplied) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(supplied)) {
    rowError(`${field} must use YYYY-MM-DD format.`, field);
  }

  const date = new Date(`${supplied}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== supplied) {
    rowError(`${field} is not a valid date.`, field);
  }

  if (date > new Date()) rowError(`${field} cannot be in the future.`, field);
  return date;
}

function splitTags(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|;]/);
  return Array.from(
    new Set(values.map((entry) => normaliseText(entry).toLowerCase()).filter(Boolean))
  );
}

function validationMessage(document) {
  const error = document.validateSync();
  if (!error) return "";
  return Object.values(error.errors || {})
    .map((entry) => entry.message)
    .filter(Boolean)
    .join(" ");
}

function cleanFileName(value) {
  const supplied = normaliseText(value).replace(/[\\/]/g, "_");
  return supplied.slice(0, 255) || "salonai-import.csv";
}

function safeRowNumber(value, index = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 2 ? parsed : index + 2;
}

function importErrorResult(rowNumber, error, displayName = "") {
  return {
    rowNumber,
    action: "error",
    status: "error",
    displayName,
    identity: "",
    code: String(error?.code || "INVALID_IMPORT_ROW"),
    message: String(error?.message || "This row is invalid."),
  };
}

export function normaliseCustomerImportRow(row = {}, rowNumber = 2) {
  const firstName = normaliseText(row.firstName);
  const lastName = normaliseText(row.lastName);
  const email = normaliseEmail(row.email);
  const phone = normaliseText(row.phone);

  if (!firstName) rowError("firstName is required.", "firstName", "IMPORT_FIELD_REQUIRED");
  if (!lastName) rowError("lastName is required.", "lastName", "IMPORT_FIELD_REQUIRED");
  if (!email && !phone) {
    rowError(
      "At least one customer contact method (email or phone) is required.",
      "email",
      "CUSTOMER_CONTACT_REQUIRED"
    );
  }
  if (email && !EMAIL_PATTERN.test(email)) rowError("email is invalid.", "email");

  const title = normaliseText(row.title);
  if (!CUSTOMER_TITLES.has(title)) rowError("title is not supported.", "title");

  const gender = normaliseText(row.gender).toLowerCase() || "prefer_not_to_say";
  if (!CUSTOMER_GENDERS.has(gender)) rowError("gender is not supported.", "gender");

  const status = normaliseText(row.status).toLowerCase() || "active";
  if (!CUSTOMER_STATUSES.has(status)) rowError("status is not supported.", "status");

  const preferredChannel =
    normaliseText(row.preferredChannel).toLowerCase() || (email ? "email" : "phone");
  if (!COMMUNICATION_CHANNELS.has(preferredChannel)) {
    rowError("preferredChannel is not supported.", "preferredChannel");
  }

  const emailConsent = parseBoolean(row.emailConsent, {
    fallback: false,
    field: "emailConsent",
  });
  const smsConsent = parseBoolean(row.smsConsent, {
    fallback: false,
    field: "smsConsent",
  });

  if (emailConsent && !email) {
    rowError("emailConsent cannot be enabled without an email address.", "emailConsent");
  }
  if (smsConsent && !phone) {
    rowError("smsConsent cannot be enabled without a phone number.", "smsConsent");
  }

  const data = {
    title,
    firstName,
    lastName,
    preferredName: normaliseText(row.preferredName),
    email: email || undefined,
    phone: phone || undefined,
    dateOfBirth: parseIsoDate(row.dateOfBirth, "dateOfBirth"),
    gender,
    address: {
      line1: normaliseText(row.addressLine1),
      line2: normaliseText(row.addressLine2),
      city: normaliseText(row.city),
      county: normaliseText(row.county),
      postcode: normaliseText(row.postcode).toUpperCase(),
      country: normaliseText(row.country) || "United Kingdom",
    },
    communicationPreferences: {
      preferredChannel,
      promotionalMessages: emailConsent || smsConsent,
      emailUnsubscribed: !emailConsent,
      smsUnsubscribed: !smsConsent,
      unsubscribed: !emailConsent && !smsConsent,
      consentSource: "csv_import",
    },
    marketing: {
      emailConsent,
      smsConsent,
      consentSource: "csv_import",
    },
    tags: splitTags(row.tags),
    notes: normaliseMultilineText(row.notes),
    source: "import",
    status,
  };

  const message = validationMessage(new Customer(data));
  if (message) rowError(message, "row");

  return {
    rowNumber,
    data,
    displayName: `${firstName} ${lastName}`,
    identity: email || phone,
    emailKey: email,
    phoneKey: canonicalPhone(phone),
  };
}

function slugify(value) {
  return normaliseText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normaliseProductImportRow(row = {}, rowNumber = 2) {
  const name = normaliseText(row.name);
  const sku = normaliseText(row.sku).toUpperCase();
  if (!name) rowError("name is required.", "name", "IMPORT_FIELD_REQUIRED");
  if (!sku) rowError("sku is required.", "sku", "IMPORT_FIELD_REQUIRED");

  const imageUrl = normaliseText(row.imageUrl);
  if (imageUrl) {
    let url;
    try {
      url = new URL(imageUrl);
    } catch {
      rowError("imageUrl must be a valid HTTPS URL.", "imageUrl");
    }
    if (url.protocol !== "https:") {
      rowError("imageUrl must use HTTPS.", "imageUrl");
    }
  }

  const data = {
    name,
    sku,
    brand: normaliseText(row.brand) || "SalonAI",
    category: normaliseText(row.category) || "Haircare",
    size: normaliseText(row.size),
    description: normaliseMultilineText(row.description),
    price: parseNonNegativeNumber(row.price, {
      field: "price",
      required: true,
    }),
    costPrice: parseNonNegativeNumber(row.costPrice, {
      field: "costPrice",
      fallback: 0,
    }),
    stockQuantity: parseNonNegativeNumber(row.stockQuantity, {
      field: "stockQuantity",
      fallback: 0,
      integer: true,
    }),
    reorderLevel: parseNonNegativeNumber(row.reorderLevel, {
      field: "reorderLevel",
      fallback: 5,
      integer: true,
    }),
    images: imageUrl ? [imageUrl] : [],
    featured: parseBoolean(row.featured, { fallback: false, field: "featured" }),
    active: parseBoolean(row.active, { fallback: true, field: "active" }),
  };

  const previewProduct = new Product({
    ...data,
    slug: `preview-${rowNumber}-${slugify(name) || "product"}`,
  });
  const message = validationMessage(previewProduct);
  if (message) rowError(message, "row");

  return {
    rowNumber,
    data,
    displayName: name,
    identity: sku,
    skuKey: sku,
  };
}

function validateRequest({ entityType, duplicatePolicy, rows }) {
  const safeType = normaliseText(entityType).toLowerCase();
  const safePolicy = normaliseText(duplicatePolicy).toLowerCase() || "skip";

  if (!IMPORT_TYPES.includes(safeType)) {
    const error = new Error("Import type must be customers or products.");
    error.statusCode = 400;
    error.code = "INVALID_IMPORT_TYPE";
    throw error;
  }
  if (!DUPLICATE_POLICIES.includes(safePolicy)) {
    const error = new Error("Duplicate policy must be skip or update.");
    error.statusCode = 400;
    error.code = "INVALID_DUPLICATE_POLICY";
    throw error;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error("The import must contain at least one data row.");
    error.statusCode = 400;
    error.code = "IMPORT_ROWS_REQUIRED";
    throw error;
  }
  if (rows.length > MAXIMUM_IMPORT_ROWS) {
    const error = new Error(`A single import can contain at most ${MAXIMUM_IMPORT_ROWS} rows.`);
    error.statusCode = 413;
    error.code = "IMPORT_TOO_LARGE";
    throw error;
  }

  return { entityType: safeType, duplicatePolicy: safePolicy };
}

async function prepareCustomerRows(rows, duplicatePolicy) {
  const prepared = [];
  const seenEmails = new Set();
  const seenPhones = new Set();

  rows.forEach((row, index) => {
    const rowNumber = safeRowNumber(row?.__rowNumber, index);
    try {
      const normalised = normaliseCustomerImportRow(row, rowNumber);
      if (normalised.emailKey && seenEmails.has(normalised.emailKey)) {
        rowError("This email address appears more than once in the file.", "email", "DUPLICATE_FILE_VALUE");
      }
      if (normalised.phoneKey && seenPhones.has(normalised.phoneKey)) {
        rowError("This phone number appears more than once in the file.", "phone", "DUPLICATE_FILE_VALUE");
      }
      if (normalised.emailKey) seenEmails.add(normalised.emailKey);
      if (normalised.phoneKey) seenPhones.add(normalised.phoneKey);
      prepared.push(normalised);
    } catch (error) {
      prepared.push({ error: importErrorResult(rowNumber, error) });
    }
  });

  const validRows = prepared.filter((entry) => !entry.error);
  const emails = validRows.map((entry) => entry.emailKey).filter(Boolean);
  const phones = validRows.map((entry) => entry.data.phone).filter(Boolean);
  const clauses = [];
  if (emails.length) clauses.push({ email: { $in: emails } });
  if (phones.length) clauses.push({ phone: { $in: phones } });

  const existing = clauses.length
    ? await Customer.find({ $or: clauses })
        .select("firstName lastName email phone status")
        .lean()
    : [];
  const byEmail = new Map(existing.filter((item) => item.email).map((item) => [normaliseEmail(item.email), item]));
  const byPhone = new Map(existing.filter((item) => item.phone).map((item) => [canonicalPhone(item.phone), item]));

  return prepared.map((entry) => {
    if (entry.error) return entry;
    const emailMatch = entry.emailKey ? byEmail.get(entry.emailKey) : null;
    const phoneMatch = entry.phoneKey ? byPhone.get(entry.phoneKey) : null;
    if (emailMatch && phoneMatch && String(emailMatch._id) !== String(phoneMatch._id)) {
      return {
        error: importErrorResult(
          entry.rowNumber,
          new ImportRowError("The email and phone match two different customer records.", {
            code: "CUSTOMER_MATCH_CONFLICT",
          }),
          entry.displayName
        ),
      };
    }

    const match = emailMatch || phoneMatch || null;
    const action = match ? (duplicatePolicy === "update" ? "update" : "skip") : "create";
    return { ...entry, existingId: match?._id || null, action };
  });
}

async function prepareProductRows(rows, duplicatePolicy) {
  const prepared = [];
  const seenSkus = new Set();

  rows.forEach((row, index) => {
    const rowNumber = safeRowNumber(row?.__rowNumber, index);
    try {
      const normalised = normaliseProductImportRow(row, rowNumber);
      if (seenSkus.has(normalised.skuKey)) {
        rowError("This SKU appears more than once in the file.", "sku", "DUPLICATE_FILE_VALUE");
      }
      seenSkus.add(normalised.skuKey);
      prepared.push(normalised);
    } catch (error) {
      prepared.push({ error: importErrorResult(rowNumber, error) });
    }
  });

  const skus = prepared.filter((entry) => !entry.error).map((entry) => entry.skuKey);
  const existing = skus.length
    ? await Product.find({ sku: { $in: skus } })
        .select("name sku stockQuantity")
        .lean()
    : [];
  const bySku = new Map(existing.map((item) => [String(item.sku).toUpperCase(), item]));

  return prepared.map((entry) => {
    if (entry.error) return entry;
    const match = bySku.get(entry.skuKey) || null;
    const action = match ? (duplicatePolicy === "update" ? "update" : "skip") : "create";
    return {
      ...entry,
      existingId: match?._id || null,
      existingStockQuantity: Number(match?.stockQuantity || 0),
      action,
    };
  });
}

function publicResult(entry) {
  if (entry.error) return entry.error;
  return {
    rowNumber: entry.rowNumber,
    action: entry.action,
    status: entry.action === "skip" ? "skipped" : "ready",
    displayName: entry.displayName,
    identity: entry.identity,
    code: entry.action === "skip" ? "EXISTING_RECORD_SKIPPED" : "",
    message:
      entry.action === "create"
        ? "Ready to create."
        : entry.action === "update"
          ? "Ready to update the existing record."
          : "An existing record matches and will be skipped.",
  };
}

function previewSummary(results) {
  return results.reduce(
    (summary, result) => {
      summary.total += 1;
      if (result.action === "create") summary.creates += 1;
      if (result.action === "update") summary.updates += 1;
      if (result.action === "skip") summary.skipped += 1;
      if (result.action === "error") summary.errors += 1;
      return summary;
    },
    { total: 0, creates: 0, updates: 0, skipped: 0, errors: 0 }
  );
}

async function prepareImport(payload) {
  const { entityType, duplicatePolicy } = validateRequest(payload);
  const prepared =
    entityType === "customers"
      ? await prepareCustomerRows(payload.rows, duplicatePolicy)
      : await prepareProductRows(payload.rows, duplicatePolicy);
  const results = prepared.map(publicResult);
  const summary = previewSummary(results);
  return {
    entityType,
    duplicatePolicy,
    prepared,
    preview: {
      entityType,
      duplicatePolicy,
      columns: entityType === "customers" ? CUSTOMER_IMPORT_COLUMNS : PRODUCT_IMPORT_COLUMNS,
      summary,
      canCommit: summary.errors === 0 && summary.creates + summary.updates > 0,
      results,
    },
  };
}

export async function previewImport(payload) {
  return (await prepareImport(payload)).preview;
}

function actorId(actor) {
  return actor?._id || actor?.id || actor;
}

function importFailure(error, entry) {
  const duplicate = Number(error?.code) === 11000;
  return {
    rowNumber: entry.rowNumber,
    action: entry.action,
    status: "failed",
    displayName: entry.displayName,
    identity: entry.identity,
    code: duplicate ? "DUPLICATE_DATABASE_VALUE" : String(error?.code || "IMPORT_ROW_FAILED"),
    message: duplicate
      ? "A record already exists with one of this row's unique values."
      : String(error?.message || "The row could not be imported."),
  };
}

async function commitCustomer(entry, actor) {
  if (entry.action === "create") {
    await createCustomerProfile(entry.data, { createdBy: actor });
    return;
  }
  await updateCustomerProfile(entry.existingId, entry.data, { updatedBy: actor });
}

async function recordImportedStock(productId, previousQuantity, newQuantity, actor, job, fileName) {
  const delta = newQuantity - previousQuantity;
  if (!delta) return;
  await InventoryAdjustment.create({
    product: productId,
    delta,
    previousQuantity,
    newQuantity,
    reason: "CSV product import",
    reference: `Import ${job._id}: ${fileName}`.slice(0, 150),
    adjustedBy: actorId(actor),
  });
}

async function commitProduct(entry, actor, job, fileName) {
  if (entry.action === "create") {
    await createProduct(entry.data);
    return;
  }

  const desiredStock = entry.data.stockQuantity;
  const catalogueData = { ...entry.data };
  delete catalogueData.stockQuantity;
  const updated = await updateProduct(entry.existingId, catalogueData);

  const product = await Product.findById(entry.existingId);
  const previousQuantity = Number(product.stockQuantity || 0);

  if (desiredStock !== previousQuantity) {
    product.stockQuantity = desiredStock;
    await product.save();
    try {
      await recordImportedStock(
        updated._id || entry.existingId,
        previousQuantity,
        desiredStock,
        actor,
        job,
        fileName
      );
    } catch (error) {
      product.stockQuantity = previousQuantity;
      await product.save();
      throw error;
    }
  }
}

function fileHash(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload.rows)).digest("hex");
}

export async function commitImport(payload, actor) {
  const preparedImport = await prepareImport(payload);
  const { preview, prepared, entityType, duplicatePolicy } = preparedImport;

  if (preview.summary.errors > 0) {
    const error = new Error("Resolve every validation error before importing.");
    error.statusCode = 422;
    error.code = "IMPORT_VALIDATION_FAILED";
    error.details = { preview };
    throw error;
  }
  if (!preview.canCommit) {
    const error = new Error("There are no new or updated records to import.");
    error.statusCode = 409;
    error.code = "IMPORT_HAS_NO_CHANGES";
    throw error;
  }

  const safeFileName = cleanFileName(payload.fileName);
  const job = await DataImportJob.create({
    entityType,
    duplicatePolicy,
    fileName: safeFileName,
    fileHash: fileHash(payload),
    requestedBy: actorId(actor),
    status: "processing",
    summary: { total: prepared.length },
  });

  const results = [];
  for (const entry of prepared) {
    if (entry.action === "skip") {
      results.push(publicResult(entry));
      continue;
    }

    try {
      if (entityType === "customers") {
        await commitCustomer(entry, actor);
      } else {
        await commitProduct(entry, actor, job, safeFileName);
      }
      results.push({
        ...publicResult(entry),
        status: "imported",
        message: entry.action === "create" ? "Created successfully." : "Updated successfully.",
      });
    } catch (error) {
      results.push(importFailure(error, entry));
    }
  }

  const summary = results.reduce(
    (totals, result) => {
      totals.total += 1;
      if (result.status === "imported" && result.action === "create") totals.created += 1;
      if (result.status === "imported" && result.action === "update") totals.updated += 1;
      if (result.status === "skipped") totals.skipped += 1;
      if (result.status === "failed") totals.failed += 1;
      return totals;
    },
    { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 }
  );

  job.summary = summary;
  job.status = summary.failed === 0 ? "completed" : summary.created + summary.updated > 0 ? "partial" : "failed";
  job.failures = results
    .filter((result) => result.status === "failed")
    .slice(0, 100)
    .map(({ rowNumber, code, message }) => ({ rowNumber, code, message }));
  job.completedAt = new Date();
  await job.save();

  return {
    jobId: job._id,
    entityType,
    duplicatePolicy,
    fileName: safeFileName,
    status: job.status,
    summary,
    results,
  };
}

export async function listImportHistory(query = {}) {
  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 10;
  const filter = {};
  const entityType = normaliseText(query.entityType).toLowerCase();
  if (IMPORT_TYPES.includes(entityType)) filter.entityType = entityType;

  const items = await DataImportJob.find(filter)
    .populate("requestedBy", "name email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return { items };
}
