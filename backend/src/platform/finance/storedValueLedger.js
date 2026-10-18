import { createHash } from "node:crypto";

export const STORED_VALUE_PROGRAM_TYPES = Object.freeze([
  "gift-card", "membership", "package", "loyalty", "wallet",
]);
export const STORED_VALUE_UNITS = Object.freeze(["money", "quantity", "points"]);
export const STORED_VALUE_EVENT_TYPES = Object.freeze([
  "issue", "redeem", "refund", "expire", "transfer", "adjustment", "reversal",
]);
export const LIABILITY_POLICIES = Object.freeze([
  "business-central", "issuing-location", "configured-entity",
]);
export const CROSS_LOCATION_REDEMPTION_POLICIES = Object.freeze([
  "same-location", "business-wide", "configured",
]);
export const SETTLEMENT_POLICIES = Object.freeze([
  "none", "receivable-payable", "manual-review",
]);

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

const clean = (value) => String(value || "").trim();

function eventDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) fail("Stored-value event date is invalid.", "INVALID_STORED_VALUE_DATE");
  return date.toISOString();
}

function deltaFor(value, unit) {
  const delta = Number(value);
  if (!Number.isFinite(delta) || delta === 0) {
    fail("Stored-value delta must be a non-zero finite number.", "INVALID_STORED_VALUE_DELTA");
  }
  return unit === "money" ? Math.round(delta * 100) / 100 : delta;
}

function currencyFor(value, unit) {
  if (unit !== "money") return "";
  const currency = clean(value || "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    fail("Stored-value currency must be a three-letter code.", "INVALID_STORED_VALUE_CURRENCY");
  }
  return currency;
}

function assertSign(eventType, delta) {
  if (["issue", "refund"].includes(eventType) && delta <= 0) {
    fail(`${eventType} events require a positive delta.`, "INVALID_STORED_VALUE_EVENT_SIGN");
  }
  if (["redeem", "expire"].includes(eventType) && delta >= 0) {
    fail(`${eventType} events require a negative delta.`, "INVALID_STORED_VALUE_EVENT_SIGN");
  }
}

export function buildStoredValueLedgerPosting(input = {}) {
  const businessId = clean(input.businessId);
  const programId = clean(input.programId);
  const instrumentId = clean(input.instrumentId);
  const eventType = clean(input.eventType).toLowerCase();
  const unit = clean(input.unit || "money").toLowerCase();

  if (!businessId || !programId || !instrumentId) {
    fail("Business, program and instrument are required for stored-value postings.", "STORED_VALUE_OWNERSHIP_REQUIRED");
  }
  if (!STORED_VALUE_EVENT_TYPES.includes(eventType)) {
    fail("Stored-value event type is invalid.", "INVALID_STORED_VALUE_EVENT_TYPE");
  }
  if (!STORED_VALUE_UNITS.includes(unit)) {
    fail("Stored-value unit is invalid.", "INVALID_STORED_VALUE_UNIT");
  }

  const delta = deltaFor(input.delta, unit);
  assertSign(eventType, delta);
  const idempotencyKey = clean(input.idempotencyKey);
  if (!idempotencyKey) fail("Stored-value postings require an idempotency key.", "STORED_VALUE_IDEMPOTENCY_REQUIRED");

  const reversalOf = clean(input.reversalOf);
  if (eventType === "reversal" && !reversalOf) {
    fail("Reversal postings must reference the original ledger entry.", "STORED_VALUE_REVERSAL_REFERENCE_REQUIRED");
  }

  const posting = {
    businessId,
    programId,
    instrumentId,
    eventType,
    unit,
    delta,
    currency: currencyFor(input.currency, unit),
    saleLocationId: clean(input.saleLocationId),
    redemptionLocationId: clean(input.redemptionLocationId),
    liabilityOwnerType: clean(input.liabilityOwnerType || "business").toLowerCase(),
    liabilityOwnerLocationId: clean(input.liabilityOwnerLocationId),
    sourceType: clean(input.sourceType),
    sourceId: clean(input.sourceId),
    idempotencyKey,
    occurredAt: eventDate(input.occurredAt),
    actor: clean(input.actor || "system"),
    reversalOf,
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {},
    writesPerformed: false,
  };

  const fingerprintPayload = {
    businessId: posting.businessId,
    programId: posting.programId,
    instrumentId: posting.instrumentId,
    eventType: posting.eventType,
    unit: posting.unit,
    delta: posting.delta,
    currency: posting.currency,
    saleLocationId: posting.saleLocationId,
    redemptionLocationId: posting.redemptionLocationId,
    liabilityOwnerType: posting.liabilityOwnerType,
    liabilityOwnerLocationId: posting.liabilityOwnerLocationId,
    sourceType: posting.sourceType,
    sourceId: posting.sourceId,
    idempotencyKey: posting.idempotencyKey,
    occurredAt: posting.occurredAt,
    reversalOf: posting.reversalOf,
  };

  return Object.freeze({
    ...posting,
    metadata: Object.freeze({ ...posting.metadata }),
    ledgerFingerprint: createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex"),
  });
}

export function deriveStoredValueBalance(entries = []) {
  if (!Array.isArray(entries)) fail("Ledger entries must be an array.", "INVALID_STORED_VALUE_LEDGER");
  const total = entries.reduce((balance, entry) => {
    const delta = Number(entry?.delta);
    if (!Number.isFinite(delta)) fail("Ledger entry delta is invalid.", "INVALID_STORED_VALUE_LEDGER");
    return balance + delta;
  }, 0);
  return Math.round(total * 1000000) / 1000000;
}

export function assertCrossLocationRedemptionAllowed({
  policy, saleLocationId, redemptionLocationId, allowedLocationIds = [],
} = {}) {
  const normalisedPolicy = clean(policy).toLowerCase();
  if (!CROSS_LOCATION_REDEMPTION_POLICIES.includes(normalisedPolicy)) {
    fail("Cross-location redemption policy is invalid.", "INVALID_CROSS_LOCATION_POLICY");
  }

  const sale = clean(saleLocationId);
  const redemption = clean(redemptionLocationId);
  if (!redemption) fail("Redemption location is required.", "REDEMPTION_LOCATION_REQUIRED");
  if (sale && sale === redemption) return true;
  if (normalisedPolicy === "business-wide") return true;

  if (normalisedPolicy === "configured") {
    const allowed = new Set((Array.isArray(allowedLocationIds) ? allowedLocationIds : [])
      .map((value) => clean(value)).filter(Boolean));
    if (allowed.has(redemption)) return true;
  }

  fail("Cross-location redemption is not permitted by the stored-value program.", "CROSS_LOCATION_REDEMPTION_NOT_ALLOWED");
}

export function planInterLocationSettlement({
  businessId,
  liabilityPolicy,
  settlementPolicy,
  saleLocationId,
  redemptionLocationId,
  amount,
  currency = "GBP",
  sourceLedgerEntryId,
  idempotencyKey,
} = {}) {
  const business = clean(businessId);
  const liability = clean(liabilityPolicy).toLowerCase();
  const settlement = clean(settlementPolicy).toLowerCase();
  const fromLocation = clean(saleLocationId);
  const toLocation = clean(redemptionLocationId);

  if (!business) fail("Business is required for settlement planning.", "SETTLEMENT_BUSINESS_REQUIRED");
  if (!LIABILITY_POLICIES.includes(liability) || !SETTLEMENT_POLICIES.includes(settlement)) {
    fail("Settlement policy is invalid.", "INVALID_SETTLEMENT_POLICY");
  }

  const crossLocation = Boolean(fromLocation && toLocation && fromLocation !== toLocation);
  if (!crossLocation || liability === "business-central" || settlement === "none") {
    return Object.freeze({
      required: false,
      reason: !crossLocation
        ? "same-location"
        : liability === "business-central"
          ? "business-central-liability"
          : "settlement-disabled",
      writesPerformed: false,
    });
  }

  const normalisedAmount = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(normalisedAmount) || normalisedAmount <= 0) {
    fail("Settlement amount must be a positive finite amount.", "INVALID_SETTLEMENT_AMOUNT");
  }

  const source = clean(sourceLedgerEntryId);
  const key = clean(idempotencyKey);
  if (!source || !key) {
    fail("Settlement requires source ledger evidence and an idempotency key.", "SETTLEMENT_EVIDENCE_REQUIRED");
  }

  const plan = {
    required: true,
    businessId: business,
    fromLocationId: fromLocation,
    toLocationId: toLocation,
    amount: normalisedAmount,
    currency: currencyFor(currency, "money"),
    settlementPolicy: settlement,
    sourceLedgerEntryId: source,
    idempotencyKey: key,
    writesPerformed: false,
  };

  return Object.freeze({
    ...plan,
    settlementFingerprint: createHash("sha256").update(JSON.stringify(plan)).digest("hex"),
  });
}

export default Object.freeze({
  buildStoredValueLedgerPosting,
  deriveStoredValueBalance,
  assertCrossLocationRedemptionAllowed,
  planInterLocationSettlement,
});
