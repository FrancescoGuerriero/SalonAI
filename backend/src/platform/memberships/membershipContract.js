import {
  buildStoredValueLedgerPosting,
} from "../finance/storedValueLedger.js";

export const MEMBERSHIP_USABLE_STATUSES = Object.freeze([
  "trial",
  "active",
]);

function fail(message, code, field = "") {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  error.statusCode = 400;
  if (field) error.details = { field };
  throw error;
}

function clean(value) {
  return String(value ?? "").trim();
}

function validDate(value, field, { optional = false } = {}) {
  if ((value === null || value === undefined || value === "") && optional) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    fail(`${field} is invalid.`, "INVALID_MEMBERSHIP_DATE", field);
  }
  return date;
}

function currency(value) {
  const result = clean(value || "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) {
    fail(
      "Membership currency must be a three-letter code.",
      "INVALID_MEMBERSHIP_CURRENCY",
      "currency"
    );
  }
  return result;
}

export function normaliseMembershipContract(input = {}) {
  const businessId = clean(input.businessId || input.business);
  const customerId = clean(input.customerId || input.customer);
  const planId = clean(input.planId || input.plan);

  if (!businessId || !customerId || !planId) {
    fail(
      "Membership contract requires business, customer and plan ownership.",
      "MEMBERSHIP_OWNERSHIP_REQUIRED"
    );
  }

  const startsAt = validDate(input.startsAt || new Date(), "startsAt");
  const renewsAt = validDate(input.renewsAt, "renewsAt", { optional: true });
  const endsAt = validDate(input.endsAt, "endsAt", { optional: true });
  const status = clean(input.status || "active").toLowerCase();

  if (
    !["trial", "active", "frozen", "past_due", "cancelled", "expired"].includes(
      status
    )
  ) {
    fail(
      "Membership contract status is invalid.",
      "INVALID_MEMBERSHIP_STATUS",
      "status"
    );
  }

  if (endsAt && endsAt <= startsAt) {
    fail(
      "Membership contract end must be after its start.",
      "INVALID_MEMBERSHIP_WINDOW",
      "endsAt"
    );
  }

  return Object.freeze({
    businessId,
    customerId,
    homeLocationId: clean(input.homeLocationId || input.homeLocation),
    planId,
    status,
    startsAt: startsAt.toISOString(),
    renewsAt: renewsAt?.toISOString() || "",
    endsAt: endsAt?.toISOString() || "",
    benefitInstrumentId: clean(
      input.benefitInstrumentId || input.benefitInstrument
    ),
    familyMemberCustomerIds: Object.freeze(
      [
        ...new Set(
          (Array.isArray(input.familyMemberCustomerIds)
            ? input.familyMemberCustomerIds
            : input.familyMemberCustomers || []
          )
            .map(clean)
            .filter(Boolean)
        ),
      ]
    ),
    paymentProvider: clean(input.paymentProvider).toLowerCase(),
    paymentProviderSubscriptionId: clean(
      input.paymentProviderSubscriptionId
    ),
    collectionStatus: clean(input.collectionStatus || "not_due").toLowerCase(),
    currency: currency(input.currency),
  });
}

export function membershipAccessState(contract, at = new Date()) {
  const normalised = normaliseMembershipContract(contract);
  const now = validDate(at, "at");
  const start = new Date(normalised.startsAt);
  const end = normalised.endsAt ? new Date(normalised.endsAt) : null;

  if (now < start) {
    return Object.freeze({ usable: false, reason: "not_started" });
  }

  if (end && now >= end) {
    return Object.freeze({ usable: false, reason: "ended" });
  }

  if (normalised.status === "frozen") {
    return Object.freeze({ usable: false, reason: "frozen" });
  }

  if (normalised.status === "past_due") {
    return Object.freeze({ usable: false, reason: "past_due" });
  }

  if (["cancelled", "expired"].includes(normalised.status)) {
    return Object.freeze({ usable: false, reason: normalised.status });
  }

  return Object.freeze({
    usable: MEMBERSHIP_USABLE_STATUSES.includes(normalised.status),
    reason: MEMBERSHIP_USABLE_STATUSES.includes(normalised.status)
      ? "active"
      : "unavailable",
  });
}

export function planMembershipCollectionRetry({
  attemptNumber,
  failedAt = new Date(),
  retryDays = [1, 3, 7],
} = {}) {
  const number = Number(attemptNumber);
  if (!Number.isInteger(number) || number < 1) {
    fail(
      "Collection attempt number must be a positive integer.",
      "INVALID_COLLECTION_ATTEMPT",
      "attemptNumber"
    );
  }

  const schedule = (Array.isArray(retryDays) ? retryDays : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 60);

  const retryIndex = number - 1;
  if (retryIndex >= schedule.length) {
    return Object.freeze({
      retry: false,
      nextRetryAt: "",
      reason: "retry_policy_exhausted",
    });
  }

  const failure = validDate(failedAt, "failedAt");
  const next = new Date(
    failure.getTime() + schedule[retryIndex] * 24 * 60 * 60 * 1000
  );

  return Object.freeze({
    retry: true,
    nextRetryAt: next.toISOString(),
    retryAfterDays: schedule[retryIndex],
    reason: "scheduled",
  });
}

export function calculateMembershipRollover({
  unused,
  newAllowance,
  rolloverEnabled = false,
  rolloverLimit = 0,
} = {}) {
  const currentUnused = Math.max(0, Number(unused) || 0);
  const allowance = Math.max(0, Number(newAllowance) || 0);
  const limit = Math.max(0, Number(rolloverLimit) || 0);

  const rolled = rolloverEnabled
    ? Math.min(currentUnused, limit)
    : 0;

  return Object.freeze({
    rolled,
    newAllowance: allowance,
    openingBalance: allowance + rolled,
  });
}

export function buildMembershipBenefitPosting({
  contract,
  programId,
  instrumentId,
  eventType,
  delta,
  unit = "quantity",
  currency: postingCurrency = "GBP",
  locationId = "",
  sourceId = "",
  idempotencyKey,
  actor = "system",
  occurredAt,
} = {}) {
  const normalised = normaliseMembershipContract(contract);
  const access = membershipAccessState(normalised, occurredAt || new Date());

  if (!access.usable && eventType === "redeem") {
    fail(
      `Membership benefits cannot be redeemed while contract is ${access.reason}.`,
      "MEMBERSHIP_BENEFIT_NOT_USABLE"
    );
  }

  return buildStoredValueLedgerPosting({
    businessId: normalised.businessId,
    programId,
    instrumentId:
      clean(instrumentId) ||
      normalised.benefitInstrumentId,
    eventType,
    delta,
    unit,
    currency: postingCurrency,
    saleLocationId: normalised.homeLocationId,
    redemptionLocationId: clean(locationId),
    liabilityOwnerType: "business",
    sourceType: "membership_contract",
    sourceId,
    idempotencyKey,
    occurredAt,
    actor,
    metadata: {
      membershipPlanId: normalised.planId,
      customerId: normalised.customerId,
    },
  });
}

export default Object.freeze({
  buildMembershipBenefitPosting,
  calculateMembershipRollover,
  membershipAccessState,
  normaliseMembershipContract,
  planMembershipCollectionRetry,
});
