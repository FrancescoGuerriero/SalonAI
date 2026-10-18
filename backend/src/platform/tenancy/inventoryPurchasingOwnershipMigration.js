import { createHash } from "node:crypto";

function text(value) {
  return String(value ?? "").trim();
}

function id(value) {
  const candidate = value?._id ?? value;
  return text(candidate) || null;
}

function stableSort(records = []) {
  return [...records].sort((left, right) =>
    text(left?._id).localeCompare(text(right?._id))
  );
}

function normaliseRecords(records = []) {
  return stableSort(Array.isArray(records) ? records : []).map((record) => ({
    _id: id(record?._id),
    business: id(record?.business),
    location: id(record?.location),
    supplier: id(record?.supplier),
    code: text(record?.code).toUpperCase() || null,
    orderNumber: text(record?.orderNumber) || null,
  }));
}

function duplicateValues(records, field) {
  const counts = new Map();
  for (const record of records) {
    const value = record[field];
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function ownershipCounts(records, targetBusinessId, targetLocationId, requireLocation) {
  let unownedBusiness = 0;
  let foreignBusiness = 0;
  let targetOwned = 0;
  let missingLocation = 0;
  let foreignLocation = 0;

  for (const record of records) {
    if (!record.business) unownedBusiness += 1;
    else if (record.business !== targetBusinessId) foreignBusiness += 1;
    else targetOwned += 1;

    if (requireLocation) {
      if (!record.location) missingLocation += 1;
      else if (record.location !== targetLocationId) foreignLocation += 1;
    }
  }

  return Object.freeze({
    total: records.length,
    unownedBusiness,
    targetOwned,
    foreignBusiness,
    missingLocation,
    foreignLocation,
  });
}

export function buildInventoryPurchasingOwnershipPlan({
  business,
  location,
  suppliers = [],
  supplierProducts = [],
  purchaseOrders = [],
} = {}) {
  const targetBusinessId = id(business);
  const targetLocationId = id(location);
  const normalisedSuppliers = normaliseRecords(suppliers);
  const normalisedSupplierProducts = normaliseRecords(supplierProducts);
  const normalisedPurchaseOrders = normaliseRecords(purchaseOrders);
  const blockers = [];
  const operations = [];

  if (!targetBusinessId) blockers.push({ type: "canonical-business-missing" });
  if (!targetLocationId) blockers.push({ type: "canonical-location-missing" });

  const supplierIds = new Set(normalisedSuppliers.map((item) => item._id).filter(Boolean));

  for (const item of normalisedSupplierProducts) {
    if (!item.supplier || !supplierIds.has(item.supplier)) {
      blockers.push({ type: "supplier-product-orphan", recordType: "SupplierProduct" });
    }
  }

  for (const item of normalisedPurchaseOrders) {
    if (!item.supplier || !supplierIds.has(item.supplier)) {
      blockers.push({ type: "purchase-order-orphan-supplier", recordType: "PurchaseOrder" });
    }
  }

  const duplicateSupplierCodes = duplicateValues(normalisedSuppliers, "code");
  const duplicateOrderNumbers = duplicateValues(normalisedPurchaseOrders, "orderNumber");
  if (duplicateSupplierCodes.length) {
    blockers.push({ type: "duplicate-supplier-code", count: duplicateSupplierCodes.length });
  }
  if (duplicateOrderNumbers.length) {
    blockers.push({ type: "duplicate-purchase-order-number", count: duplicateOrderNumbers.length });
  }

  for (const [recordType, records, requireLocation] of [
    ["Supplier", normalisedSuppliers, false],
    ["SupplierProduct", normalisedSupplierProducts, false],
    ["PurchaseOrder", normalisedPurchaseOrders, true],
  ]) {
    for (const record of records) {
      if (record.business && targetBusinessId && record.business !== targetBusinessId) {
        blockers.push({ type: "foreign-business-ownership", recordType });
      }
      if (
        requireLocation &&
        record.location &&
        targetLocationId &&
        record.location !== targetLocationId
      ) {
        blockers.push({ type: "foreign-location-ownership", recordType });
      }

      const set = {};
      if (!record.business && targetBusinessId) set.business = targetBusinessId;
      if (requireLocation && !record.location && targetLocationId) set.location = targetLocationId;
      if (Object.keys(set).length > 0 && record._id) {
        operations.push({
          type: `${recordType.toLowerCase()}-update`,
          recordType,
          recordId: record._id,
          set,
        });
      }
    }
  }

  operations.sort((left, right) =>
    `${left.recordType}:${left.recordId}`.localeCompare(`${right.recordType}:${right.recordId}`)
  );

  const coverage = Object.freeze({
    suppliers: ownershipCounts(normalisedSuppliers, targetBusinessId, targetLocationId, false),
    supplierProducts: ownershipCounts(
      normalisedSupplierProducts,
      targetBusinessId,
      targetLocationId,
      false
    ),
    purchaseOrders: ownershipCounts(
      normalisedPurchaseOrders,
      targetBusinessId,
      targetLocationId,
      true
    ),
  });

  const summary = Object.freeze({
    supplierCount: normalisedSuppliers.length,
    supplierProductCount: normalisedSupplierProducts.length,
    purchaseOrderCount: normalisedPurchaseOrders.length,
    operationCount: operations.length,
    blockerCount: blockers.length,
  });

  const executable = Boolean(targetBusinessId && targetLocationId && blockers.length === 0);

  return Object.freeze({
    executable,
    idempotentNoop: executable && operations.length === 0,
    target: Object.freeze({ businessId: targetBusinessId, locationId: targetLocationId }),
    coverage,
    summary,
    blockers: Object.freeze(blockers),
    operations: Object.freeze(operations),
  });
}

export function calculateInventoryPurchasingPlanFingerprint(plan) {
  const payload = JSON.stringify({
    target: plan?.target || null,
    coverage: plan?.coverage || null,
    summary: plan?.summary || null,
    blockers: plan?.blockers || [],
    operations: plan?.operations || [],
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function sanitiseInventoryPurchasingPlan(plan) {
  return Object.freeze({
    readOnly: true,
    writesPerformed: false,
    executable: Boolean(plan?.executable),
    idempotentNoop: Boolean(plan?.idempotentNoop),
    coverage: plan?.coverage || {},
    summary: plan?.summary || {},
    blockerTypes: Object.freeze(
      (plan?.blockers || []).reduce((counts, blocker) => {
        const type = text(blocker?.type) || "unknown";
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {})
    ),
    operationTypes: Object.freeze(
      (plan?.operations || []).reduce((counts, operation) => {
        const type = text(operation?.type) || "unknown";
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {})
    ),
    identifiersIncluded: false,
    piiIncluded: false,
  });
}
