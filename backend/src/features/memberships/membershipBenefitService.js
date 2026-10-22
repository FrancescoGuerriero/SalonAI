import { createHash } from "node:crypto";
import mongoose from "mongoose";

import MembershipContract from "../../models/MembershipContract.js";
import StoredValueInstrument from "../../models/StoredValueInstrument.js";
import StoredValueLedgerEntry from "../../models/StoredValueLedgerEntry.js";
import StoredValueProgram from "../../models/StoredValueProgram.js";
import {
  assertCrossLocationRedemptionAllowed,
  deriveStoredValueBalance,
} from "../../platform/finance/storedValueLedger.js";
import {
  buildMembershipBenefitPosting,
  membershipAccessState,
} from "../../platform/memberships/membershipContract.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(
      `${field} must be a valid identifier.`,
      400,
      { field }
    );
  }
  return value;
}

function positive(value, field) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createServiceError(
      `${field} must be a positive number.`,
      400,
      { field }
    );
  }
  return amount;
}

function instrumentReference(contractId, benefitKey) {
  return createHash("sha256")
    .update(`membership:${contractId}:benefit:${benefitKey}`)
    .digest("hex");
}

function contractInput(contract) {
  return {
    business: String(contract.business),
    customer: String(contract.customer?._id || contract.customer),
    plan: String(contract.plan?._id || contract.plan),
    status: contract.status,
    startsAt: contract.startsAt,
    renewsAt: contract.renewsAt,
    endsAt: contract.endsAt,
    homeLocation: contract.homeLocation ? String(contract.homeLocation) : "",
    benefitInstrument: contract.benefitInstrument
      ? String(contract.benefitInstrument)
      : "",
    paymentProvider: contract.paymentProvider,
    paymentProviderSubscriptionId: contract.paymentProviderSubscriptionId,
    collectionStatus: contract.collectionStatus,
  };
}

async function loadContract(contractId, businessId, session = null) {
  objectId(contractId, "membershipContract");
  objectId(businessId, "business");

  let query = MembershipContract.findOne({
    _id: contractId,
    business: businessId,
  }).populate("plan");

  if (session) query = query.session(session);

  return assertFound(
    await query,
    "Membership contract not found."
  );
}

function benefitDefinition(contract, benefitKey) {
  const key = text(benefitKey).toLowerCase();
  const benefit = (contract.plan?.benefits || []).find(
    (item) => text(item.key).toLowerCase() === key
  );

  if (!benefit) {
    throw createServiceError(
      "Membership benefit is not defined by this plan.",
      404,
      { field: "benefitKey" }
    );
  }

  return benefit;
}

async function membershipProgram(contract, session = null) {
  const programId = contract.plan?.storedValueProgram;
  if (!programId) {
    throw createServiceError(
      "This membership plan does not have a stored-value programme.",
      409
    );
  }

  let query = StoredValueProgram.findOne({
    _id: programId,
    business: contract.business,
    programType: "membership",
    status: "active",
  });

  if (session) query = query.session(session);

  return assertFound(
    await query,
    "The membership stored-value programme is not active."
  );
}

async function ensureBenefitInstrument(contract, benefit, session = null) {
  const existingWallet = (contract.benefitWallets || []).find(
    (wallet) => wallet.key === benefit.key
  );

  if (existingWallet?.instrument) {
    let query = StoredValueInstrument.findOne({
      _id: existingWallet.instrument,
      business: contract.business,
      status: { $nin: ["closed", "expired"] },
    });
    if (session) query = query.session(session);
    const instrument = await query;
    if (instrument) return instrument;
  }

  const program = await membershipProgram(contract, session);
  const reference = instrumentReference(contract._id, benefit.key);
  const filter = {
    business: contract.business,
    externalReferenceHash: reference,
  };
  const update = {
    $setOnInsert: {
      business: contract.business,
      program: program._id,
      customer: contract.customer,
      originLocation: contract.homeLocation || null,
      externalReferenceHash: reference,
      status: "active",
      unit: benefit.unit,
      currency: benefit.unit === "money" ? contract.plan.currency : "",
      metadata: {
        sourceType: "membership_contract",
        membershipContractId: String(contract._id),
        membershipBenefitKey: benefit.key,
      },
    },
  };

  let query = StoredValueInstrument.findOneAndUpdate(
    filter,
    update,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
  if (session) query = query.session(session);
  const instrument = await query;

  const wallets = Array.isArray(contract.benefitWallets)
    ? contract.benefitWallets
    : [];
  const index = wallets.findIndex((wallet) => wallet.key === benefit.key);
  const wallet = {
    key: benefit.key,
    instrument: instrument._id,
    unit: benefit.unit,
    currency: benefit.unit === "money" ? contract.plan.currency : "",
  };

  if (index >= 0) wallets[index] = wallet;
  else wallets.push(wallet);
  contract.benefitWallets = wallets;

  if (!contract.benefitInstrument) {
    contract.benefitInstrument = instrument._id;
  }

  await contract.save(session ? { session } : undefined);
  return instrument;
}

async function ledgerBalance(instrumentId, session = null) {
  let query = StoredValueLedgerEntry.find({ instrument: instrumentId })
    .sort({ occurredAt: 1, _id: 1 })
    .select("delta");
  if (session) query = query.session(session);
  return deriveStoredValueBalance(await query.lean());
}

async function persistPosting(posting, session = null) {
  let existingQuery = StoredValueLedgerEntry.findOne({
    business: posting.businessId,
    idempotencyKey: posting.idempotencyKey,
  });
  if (session) existingQuery = existingQuery.session(session);
  const existing = await existingQuery.lean();
  if (existing) return existing;

  const document = {
    business: posting.businessId,
    program: posting.programId,
    instrument: posting.instrumentId,
    eventType: posting.eventType,
    unit: posting.unit,
    delta: posting.delta,
    currency: posting.currency,
    saleLocation: posting.saleLocationId || null,
    redemptionLocation: posting.redemptionLocationId || null,
    liabilityOwnerType: posting.liabilityOwnerType,
    liabilityOwnerLocation: posting.liabilityOwnerLocationId || null,
    sourceType: posting.sourceType,
    sourceId: posting.sourceId,
    idempotencyKey: posting.idempotencyKey,
    occurredAt: new Date(posting.occurredAt),
    actor: posting.actor,
    reversalOf: posting.reversalOf || null,
    ledgerFingerprint: posting.ledgerFingerprint,
    metadata: posting.metadata,
  };

  if (session) {
    const [created] = await StoredValueLedgerEntry.create([document], { session });
    return created.toObject();
  }
  return (await StoredValueLedgerEntry.create(document)).toObject();
}

async function postBenefitEvent({
  contract,
  benefit,
  eventType,
  amount,
  locationId = "",
  idempotencyKey,
  actor = "system",
  occurredAt = new Date(),
  session = null,
}) {
  const program = await membershipProgram(contract, session);
  const instrument = await ensureBenefitInstrument(contract, benefit, session);
  const currentBalance = await ledgerBalance(instrument._id, session);

  if (eventType === "redeem" && currentBalance < amount) {
    throw createServiceError(
      "The membership benefit does not have enough available balance.",
      409,
      {
        availableBalance: currentBalance,
        requested: amount,
      }
    );
  }

  if (eventType === "redeem") {
    assertCrossLocationRedemptionAllowed({
      policy: program.crossLocationRedemptionPolicy,
      saleLocationId: instrument.originLocation
        ? String(instrument.originLocation)
        : "",
      redemptionLocationId: locationId,
      allowedLocationIds: program.allowedLocations || [],
    });
  }

  const posting = buildMembershipBenefitPosting({
    contract: contractInput(contract),
    programId: String(program._id),
    instrumentId: String(instrument._id),
    eventType,
    delta: eventType === "redeem" ? -Math.abs(amount) : Math.abs(amount),
    unit: benefit.unit,
    currency: contract.plan.currency,
    locationId,
    sourceId: String(contract._id),
    idempotencyKey,
    actor,
    occurredAt,
  });

  const entry = await persistPosting(posting, session);
  const balance = await ledgerBalance(instrument._id, session);

  await StoredValueInstrument.updateOne(
    { _id: instrument._id },
    {
      $set: { cachedBalance: balance },
      $inc: { cacheRevision: 1 },
    },
    session ? { session } : undefined
  );

  return {
    benefitKey: benefit.key,
    instrumentId: String(instrument._id),
    unit: benefit.unit,
    currency: benefit.unit === "money" ? contract.plan.currency : "",
    entry,
    balance,
  };
}

export async function membershipBenefitBalances(
  contractId,
  { businessId } = {}
) {
  const contract = await loadContract(contractId, businessId);
  const results = [];

  for (const benefit of contract.plan?.benefits || []) {
    const instrument = await ensureBenefitInstrument(contract, benefit);
    results.push({
      benefitKey: benefit.key,
      allowance: benefit.allowance,
      unit: benefit.unit,
      currency: benefit.unit === "money" ? contract.plan.currency : "",
      instrumentId: String(instrument._id),
      balance: await ledgerBalance(instrument._id),
    });
  }

  return results;
}

export async function issueMembershipBenefits(
  contractId,
  payload = {},
  { businessId, actor = "system" } = {}
) {
  const contract = await loadContract(contractId, businessId);
  const access = membershipAccessState(contractInput(contract), payload.occurredAt || new Date());
  if (!access.usable) {
    throw createServiceError(
      `Membership benefits cannot be issued while contract is ${access.reason}.`,
      409
    );
  }

  const cycleKey = text(payload.cycleKey || contract.nextCollectionAt || contract.startsAt);
  if (!cycleKey) {
    throw createServiceError("A membership benefit cycle key is required.", 400, {
      field: "cycleKey",
    });
  }

  const results = [];
  for (const benefit of contract.plan?.benefits || []) {
    if (Number(benefit.allowance) <= 0) continue;
    results.push(
      await postBenefitEvent({
        contract,
        benefit,
        eventType: "issue",
        amount: benefit.allowance,
        locationId: payload.locationId || contract.homeLocation || "",
        idempotencyKey:
          text(payload.idempotencyPrefix) ||
          `membership:${contract._id}:benefit:${benefit.key}:issue:${cycleKey}`,
        actor,
        occurredAt: payload.occurredAt || new Date(),
      })
    );
  }

  return results;
}

export async function redeemMembershipBenefit(
  contractId,
  benefitKey,
  payload = {},
  { businessId, actor = "system" } = {}
) {
  const contract = await loadContract(contractId, businessId);
  const access = membershipAccessState(contractInput(contract), payload.occurredAt || new Date());
  if (!access.usable) {
    throw createServiceError(
      `Membership benefits cannot be redeemed while contract is ${access.reason}.`,
      409
    );
  }

  const benefit = benefitDefinition(contract, benefitKey);
  const amount = positive(payload.amount ?? payload.quantity, "amount");
  const locationId = text(payload.locationId || contract.homeLocation);
  if (!locationId) {
    throw createServiceError(
      "A redemption location is required.",
      400,
      { field: "locationId" }
    );
  }

  const idempotencyKey = text(payload.idempotencyKey);
  if (!idempotencyKey) {
    throw createServiceError(
      "Membership benefit redemption requires an idempotency key.",
      400,
      { field: "idempotencyKey" }
    );
  }

  return postBenefitEvent({
    contract,
    benefit,
    eventType: "redeem",
    amount,
    locationId,
    idempotencyKey,
    actor,
    occurredAt: payload.occurredAt || new Date(),
  });
}

export default {
  issueMembershipBenefits,
  membershipBenefitBalances,
  redeemMembershipBenefit,
};
