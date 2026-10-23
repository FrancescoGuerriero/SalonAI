import { createHash } from "node:crypto";
import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import ClinicalAccessLog from "../../models/ClinicalAccessLog.js";
import ClinicalCapabilityEligibility from "../../models/ClinicalCapabilityEligibility.js";
import ClinicalConsentRecord, {
  CLINICAL_CONSENT_PURPOSES,
} from "../../models/ClinicalConsentRecord.js";
import ClinicalIntakeForm from "../../models/ClinicalIntakeForm.js";
import ClinicalMedia from "../../models/ClinicalMedia.js";
import ClinicalProfile from "../../models/ClinicalProfile.js";
import Customer from "../../models/customer.js";
import PrescriptionReference from "../../models/PrescriptionReference.js";
import ProviderCredential from "../../models/ProviderCredential.js";
import TreatmentRecord from "../../models/TreatmentRecord.js";
import User from "../../models/user.js";
import InventoryItem from "../inventory/InventoryItem.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated clinical actor is required.", 401);
  }
  return value;
}

function date(value, field, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return result;
}

function clinicalContext(context = {}) {
  const businessId = objectId(context.businessId, "business");
  const locationId = objectId(context.locationId, "location");
  const regionKey = lower(context.regionKey);
  if (!regionKey) {
    throw createServiceError("Clinical region authority is required.", 403, {
      code: "CLINICAL_REGION_AUTHORITY_REQUIRED",
    });
  }
  return { businessId, locationId, regionKey };
}

function cleanObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

async function logClinicalAccess({
  context,
  user,
  action,
  resourceType,
  resourceId,
  clinicalProfile = null,
  purpose = "clinical-care",
  requestId = "",
  metadata = {},
}) {
  const ctx = clinicalContext(context);
  return ClinicalAccessLog.create({
    business: ctx.businessId,
    location: ctx.locationId,
    actor: actorId(user),
    action,
    resourceType,
    resourceId: String(resourceId),
    clinicalProfile: mongoose.isValidObjectId(clinicalProfile)
      ? clinicalProfile
      : null,
    purpose: text(purpose || "clinical-care"),
    requestId: text(requestId),
    metadata: cleanObject(metadata),
  });
}

async function profileForBusiness(profileId, context) {
  const ctx = clinicalContext(context);
  objectId(profileId, "clinicalProfile");
  return assertFound(
    await ClinicalProfile.findOne({
      _id: profileId,
      business: ctx.businessId,
    }),
    "Clinical profile not found."
  );
}

async function customerForBusiness(customerId, context) {
  const ctx = clinicalContext(context);
  objectId(customerId, "customer");
  return assertFound(
    await Customer.findOne({
      _id: customerId,
      business: ctx.businessId,
      status: { $ne: "deleted" },
    }),
    "Tenant-owned customer not found. Clinical Pack excludes legacy/unowned customer records."
  );
}

async function latestConsent(profile, purpose, scopeKey, context) {
  const ctx = clinicalContext(context);
  const now = new Date();
  const scope = lower(scopeKey);
  return ClinicalConsentRecord.findOne({
    business: ctx.businessId,
    clinicalProfile: profile._id,
    purpose,
    validFrom: { $lte: now },
    $or: [{ validUntil: null }, { validUntil: { $gt: now } }],
    ...(scope
      ? { scopeKey: { $in: [scope, ""] } }
      : { scopeKey: "" }),
  })
    .sort({ recordedAt: -1, _id: -1 })
    .lean();
}

async function assertCurrentConsent(profile, purpose, scopeKey, context) {
  const consent = await latestConsent(profile, purpose, scopeKey, context);
  if (!consent || consent.granted !== true) {
    throw createServiceError(
      `Current ${purpose} consent is required.`,
      409,
      {
        code: "CLINICAL_CONSENT_REQUIRED",
        purpose,
        scopeKey: lower(scopeKey),
      }
    );
  }
  return consent;
}

export async function createClinicalProfile(
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const customer = await customerForBusiness(payload.customerId || payload.customer, ctx);
  const existing = await ClinicalProfile.findOne({
    business: ctx.businessId,
    customer: customer._id,
  });
  if (existing) return existing.toObject();

  const profile = await ClinicalProfile.create({
    business: ctx.businessId,
    customer: customer._id,
    homeLocation: ctx.locationId,
    status: "active",
    dataClassification: "restricted-clinical",
    primaryProvider: mongoose.isValidObjectId(payload.primaryProvider)
      ? payload.primaryProvider
      : null,
    externalPatientReferenceHash: text(payload.externalPatientReferenceHash).toLowerCase(),
    createdBy: actor,
    updatedBy: actor,
    metadata: cleanObject(payload.metadata),
  });
  await logClinicalAccess({
    context: ctx,
    user,
    action: "create",
    resourceType: "ClinicalProfile",
    resourceId: profile._id,
    clinicalProfile: profile._id,
    requestId,
  });
  return profile.toObject();
}

export async function getClinicalProfile(
  profileId,
  { context = {}, user, requestId = "" } = {}
) {
  const profile = await profileForBusiness(profileId, context);
  await logClinicalAccess({
    context,
    user,
    action: "read",
    resourceType: "ClinicalProfile",
    resourceId: profile._id,
    clinicalProfile: profile._id,
    requestId,
  });
  return profile.toObject();
}

export async function listClinicalProfiles(
  query = {},
  { context = {} } = {}
) {
  const ctx = clinicalContext(context);
  const match = { business: ctx.businessId };
  if (query.customer) match.customer = objectId(query.customer, "customer");
  if (query.status) match.status = lower(query.status);
  return ClinicalProfile.find(match)
    .populate("customer", "firstName lastName preferredName email phone")
    .populate("homeLocation", "name slug hierarchy.regionKey")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(200, Number(query.limit) || 50)))
    .lean();
}

export async function recordClinicalConsent(
  profileId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const profile = await profileForBusiness(profileId, ctx);
  const purpose = lower(payload.purpose);
  if (!CLINICAL_CONSENT_PURPOSES.includes(purpose)) {
    throw createServiceError(
      `purpose must be one of: ${CLINICAL_CONSENT_PURPOSES.join(", ")}.`,
      400,
      { field: "purpose" }
    );
  }
  if (typeof payload.granted !== "boolean") {
    throw createServiceError("granted must be a boolean.", 400, {
      field: "granted",
    });
  }
  const policyVersion = text(payload.policyVersion);
  if (!policyVersion) {
    throw createServiceError("policyVersion is required.", 400, {
      field: "policyVersion",
    });
  }
  const scopeKey = lower(payload.scopeKey);
  const previous = await ClinicalConsentRecord.findOne({
    business: ctx.businessId,
    clinicalProfile: profile._id,
    purpose,
    scopeKey,
  })
    .sort({ recordedAt: -1, _id: -1 })
    .lean();
  const validFrom = date(payload.validFrom || new Date(), "validFrom", {
    optional: false,
  });
  const validUntil = date(payload.validUntil, "validUntil");
  if (validUntil && validUntil <= validFrom) {
    throw createServiceError("validUntil must be later than validFrom.", 400, {
      field: "validUntil",
    });
  }

  const consent = await ClinicalConsentRecord.create({
    business: ctx.businessId,
    location: ctx.locationId,
    clinicalProfile: profile._id,
    customer: profile.customer,
    purpose,
    scopeKey,
    granted: payload.granted,
    policyVersion,
    evidence: cleanObject(payload.evidence),
    source: text(payload.source || "staff-assisted"),
    recordedBy: actor,
    recordedAt: new Date(),
    validFrom,
    validUntil,
    supersedes: previous?._id || null,
  });
  await logClinicalAccess({
    context: ctx,
    user,
    action: "consent_record",
    resourceType: "ClinicalConsentRecord",
    resourceId: consent._id,
    clinicalProfile: profile._id,
    purpose,
    requestId,
    metadata: { granted: payload.granted, scopeKey },
  });
  return consent.toObject();
}

export async function listClinicalConsents(
  profileId,
  query = {},
  { context = {} } = {}
) {
  const ctx = clinicalContext(context);
  const profile = await profileForBusiness(profileId, ctx);
  const match = {
    business: ctx.businessId,
    clinicalProfile: profile._id,
  };
  if (query.purpose) match.purpose = lower(query.purpose);
  return ClinicalConsentRecord.find(match)
    .sort({ recordedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(500, Number(query.limit) || 100)))
    .lean();
}

export async function createClinicalIntake(
  profileId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const profile = await profileForBusiness(profileId, ctx);
  const formKey = lower(payload.formKey);
  const formVersion = text(payload.formVersion);
  if (!formKey || !formVersion) {
    throw createServiceError("formKey and formVersion are required.", 400);
  }
  const intake = await ClinicalIntakeForm.create({
    business: ctx.businessId,
    location: ctx.locationId,
    clinicalProfile: profile._id,
    customer: profile.customer,
    formKey,
    formVersion,
    responses: cleanObject(payload.responses),
    status: "draft",
    createdBy: actor,
    updatedBy: actor,
  });
  await logClinicalAccess({
    context: ctx,
    user,
    action: "create",
    resourceType: "ClinicalIntakeForm",
    resourceId: intake._id,
    clinicalProfile: profile._id,
    requestId,
  });
  return intake.toObject();
}

export async function updateClinicalIntake(
  intakeId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const intake = assertFound(
    await ClinicalIntakeForm.findOne({
      _id: objectId(intakeId, "intake"),
      business: ctx.businessId,
      location: ctx.locationId,
      status: "draft",
    }),
    "Editable clinical intake form not found."
  );
  intake.responses = cleanObject(payload.responses);
  intake.updatedBy = actorId(user);
  await intake.save();
  await logClinicalAccess({
    context: ctx,
    user,
    action: "update",
    resourceType: "ClinicalIntakeForm",
    resourceId: intake._id,
    clinicalProfile: intake.clinicalProfile,
    requestId,
  });
  return intake.toObject();
}

export async function submitClinicalIntake(
  intakeId,
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const intake = assertFound(
    await ClinicalIntakeForm.findOne({
      _id: objectId(intakeId, "intake"),
      business: ctx.businessId,
      location: ctx.locationId,
      status: "draft",
    }),
    "Draft clinical intake form not found."
  );
  intake.status = "submitted";
  intake.submittedAt = new Date();
  intake.updatedBy = actorId(user);
  await intake.save();
  await logClinicalAccess({
    context: ctx,
    user,
    action: "submit",
    resourceType: "ClinicalIntakeForm",
    resourceId: intake._id,
    clinicalProfile: intake.clinicalProfile,
    requestId,
  });
  return intake.toObject();
}

export async function reviewClinicalIntake(
  intakeId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const intake = assertFound(
    await ClinicalIntakeForm.findOne({
      _id: objectId(intakeId, "intake"),
      business: ctx.businessId,
      location: ctx.locationId,
      status: "submitted",
    }),
    "Submitted clinical intake form not found."
  );
  intake.status = "reviewed";
  intake.reviewedBy = actor;
  intake.reviewedAt = new Date();
  intake.reviewNote = text(payload.reviewNote);
  intake.updatedBy = actor;
  await intake.save();
  await logClinicalAccess({
    context: ctx,
    user,
    action: "review",
    resourceType: "ClinicalIntakeForm",
    resourceId: intake._id,
    clinicalProfile: intake.clinicalProfile,
    requestId,
  });
  return intake.toObject();
}

export async function createProviderCredential(
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const providerUser = objectId(payload.providerUser, "providerUser");
  assertFound(await User.findById(providerUser).select("_id"), "Provider user not found.");
  const credentialType = lower(payload.credentialType);
  const credentialReference = text(payload.credentialReference);
  const jurisdiction = text(payload.jurisdiction);
  if (!credentialType || !credentialReference || !jurisdiction) {
    throw createServiceError(
      "credentialType, credentialReference and jurisdiction are required.",
      400
    );
  }
  const requestedRegions = [
    ...new Set(
      (Array.isArray(payload.regionKeys) && payload.regionKeys.length
        ? payload.regionKeys
        : [ctx.regionKey]
      )
        .map(lower)
        .filter(Boolean)
    ),
  ];
  const eligibleRegions = await ClinicalCapabilityEligibility.find({
    business: ctx.businessId,
    regionKey: { $in: requestedRegions },
    status: "eligible",
  })
    .select("regionKey")
    .lean();
  if (eligibleRegions.length !== requestedRegions.length) {
    throw createServiceError(
      "Provider credential regions must already be explicitly eligible for the Clinical Pack.",
      409,
      { code: "CLINICAL_CREDENTIAL_REGION_NOT_ELIGIBLE" }
    );
  }
  const scopeKeys = [
    ...new Set(
      (Array.isArray(payload.scopeKeys) ? payload.scopeKeys : [])
        .map(lower)
        .filter(Boolean)
    ),
  ];
  if (!scopeKeys.length) {
    throw createServiceError("At least one provider scopeKey is required.", 400, {
      field: "scopeKeys",
    });
  }

  const credential = await ProviderCredential.create({
    business: ctx.businessId,
    providerUser,
    credentialType,
    credentialReference,
    jurisdiction,
    regionKeys: requestedRegions,
    scopeKeys,
    status: "pending",
    validFrom: date(payload.validFrom, "validFrom"),
    validUntil: date(payload.validUntil, "validUntil"),
    createdBy: actor,
    updatedBy: actor,
  });
  await logClinicalAccess({
    context: ctx,
    user,
    action: "create",
    resourceType: "ProviderCredential",
    resourceId: credential._id,
    requestId,
  });
  return credential.toObject();
}

export async function verifyProviderCredential(
  credentialId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const credential = assertFound(
    await ProviderCredential.findOne({
      _id: objectId(credentialId, "providerCredential"),
      business: ctx.businessId,
      status: { $in: ["pending", "verified"] },
    }),
    "Provider credential not found."
  );
  const validFrom = date(payload.validFrom || credential.validFrom || new Date(), "validFrom", {
    optional: false,
  });
  const validUntil = date(payload.validUntil || credential.validUntil, "validUntil");
  if (validUntil && validUntil <= validFrom) {
    throw createServiceError("validUntil must be later than validFrom.", 400, {
      field: "validUntil",
    });
  }
  credential.status = "verified";
  credential.validFrom = validFrom;
  credential.validUntil = validUntil;
  credential.verifiedBy = actor;
  credential.verifiedAt = new Date();
  credential.verificationEvidence = cleanObject(payload.verificationEvidence);
  credential.updatedBy = actor;
  await credential.save();
  await logClinicalAccess({
    context: ctx,
    user,
    action: "credential_verify",
    resourceType: "ProviderCredential",
    resourceId: credential._id,
    requestId,
  });
  return credential.toObject();
}

export async function listProviderCredentials(
  query = {},
  { context = {} } = {}
) {
  const ctx = clinicalContext(context);
  const match = { business: ctx.businessId };
  if (query.providerUser) {
    match.providerUser = objectId(query.providerUser, "providerUser");
  }
  if (query.status) match.status = lower(query.status);
  return ProviderCredential.find(match)
    .populate("providerUser", "name email")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(200, Number(query.limit) || 50)))
    .lean();
}

async function verifiedCredentialForActor(
  credentialId,
  procedureKey,
  context,
  user
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const now = new Date();
  const credential = assertFound(
    await ProviderCredential.findOne({
      _id: objectId(credentialId, "providerCredential"),
      business: ctx.businessId,
      providerUser: actor,
      status: "verified",
      regionKeys: ctx.regionKey,
      $and: [
        { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
        { $or: [{ validUntil: null }, { validUntil: { $gt: now } }] },
      ],
    }).lean(),
    "A current verified provider credential for this region is required."
  );
  const scope = lower(procedureKey);
  if (!credential.scopeKeys.includes("*") && !credential.scopeKeys.includes(scope)) {
    throw createServiceError(
      "The provider credential does not authorise this clinical scope.",
      403,
      { code: "CLINICAL_PROVIDER_SCOPE_REQUIRED", scopeKey: scope }
    );
  }
  return credential;
}

async function normaliseLotUsage(value, performedAt, context) {
  const ctx = clinicalContext(context);
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw createServiceError("lotUsage must be an array.", 400, {
      field: "lotUsage",
    });
  }
  if (value.length > 50) {
    throw createServiceError("lotUsage may contain at most 50 entries.", 400, {
      field: "lotUsage",
    });
  }
  const ids = [
    ...new Set(value.map((item) => String(item?.inventoryItem || "")).filter(Boolean)),
  ];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    throw createServiceError("lotUsage contains an invalid inventoryItem.", 400, {
      field: "lotUsage",
    });
  }
  const items = await InventoryItem.find({
    _id: { $in: ids },
    business: ctx.businessId,
    location: ctx.locationId,
    active: true,
  })
    .select("_id sku name unit business location active")
    .lean();
  const byId = new Map(items.map((item) => [String(item._id), item]));
  if (items.length !== ids.length) {
    throw createServiceError(
      "Clinical lot usage requires active inventory explicitly owned by the current Business and Location.",
      409,
      { code: "CLINICAL_INVENTORY_OWNERSHIP_REQUIRED" }
    );
  }

  return value.map((entry, index) => {
    const item = byId.get(String(entry.inventoryItem));
    const lotNumber = text(entry.lotNumber);
    const expiryAt = date(entry.expiryAt, `lotUsage[${index}].expiryAt`, {
      optional: false,
    });
    const quantity = Number(entry.quantity);
    if (!lotNumber || !Number.isFinite(quantity) || quantity <= 0) {
      throw createServiceError(
        `lotUsage[${index}] requires lotNumber and a positive quantity.`,
        400,
        { field: `lotUsage[${index}]` }
      );
    }
    if (expiryAt < performedAt) {
      throw createServiceError(
        `lotUsage[${index}] is expired for the recorded treatment time.`,
        409,
        { code: "CLINICAL_EXPIRED_LOT_PROHIBITED" }
      );
    }
    return {
      inventoryItem: item._id,
      skuSnapshot: item.sku,
      itemNameSnapshot: item.name,
      lotNumber,
      expiryAt,
      quantity,
      unit: text(entry.unit || item.unit || "unit"),
    };
  });
}

export async function createTreatmentRecord(
  profileId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const profile = await profileForBusiness(profileId, ctx);
  const procedureKey = lower(payload.procedureKey);
  const procedureLabel = text(payload.procedureLabel);
  if (!procedureKey || !procedureLabel) {
    throw createServiceError("procedureKey and procedureLabel are required.", 400);
  }
  const consent = await assertCurrentConsent(
    profile,
    "clinical_treatment",
    procedureKey,
    ctx
  );
  const performedAt = date(payload.performedAt || new Date(), "performedAt", {
    optional: false,
  });
  let appointment = null;
  if (payload.appointment) {
    appointment = assertFound(
      await Appointment.findOne({
        _id: objectId(payload.appointment, "appointment"),
        business: ctx.businessId,
        location: ctx.locationId,
        customer: profile.customer,
      }).select("_id"),
      "Tenant/location-owned appointment not found for this clinical profile."
    );
  }
  const providerUser = mongoose.isValidObjectId(payload.providerUser)
    ? payload.providerUser
    : actor;
  const lotUsage = await normaliseLotUsage(payload.lotUsage, performedAt, ctx);
  const record = await TreatmentRecord.create({
    business: ctx.businessId,
    location: ctx.locationId,
    clinicalProfile: profile._id,
    customer: profile.customer,
    appointment: appointment?._id || null,
    providerUser,
    treatmentConsent: consent._id,
    procedureKey,
    procedureLabel,
    performedAt,
    clinicianAssessment: text(payload.clinicianAssessment),
    treatmentPerformed: text(payload.treatmentPerformed),
    aftercareInstructions: text(payload.aftercareInstructions),
    lotUsage,
    status: "draft",
    aiDraftUsed: payload.aiDraftUsed === true,
    aiDraftInferenceId: text(payload.aiDraftInferenceId),
    createdBy: actor,
    updatedBy: actor,
  });
  await logClinicalAccess({
    context: ctx,
    user,
    action: "create",
    resourceType: "TreatmentRecord",
    resourceId: record._id,
    clinicalProfile: profile._id,
    requestId,
  });
  return record.toObject();
}

export async function updateTreatmentRecord(
  recordId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const record = assertFound(
    await TreatmentRecord.findOne({
      _id: objectId(recordId, "treatmentRecord"),
      business: ctx.businessId,
      location: ctx.locationId,
      status: "draft",
    }),
    "Editable draft treatment record not found."
  );
  const performedAt = payload.performedAt
    ? date(payload.performedAt, "performedAt", { optional: false })
    : record.performedAt;
  if (payload.procedureLabel !== undefined) {
    record.procedureLabel = text(payload.procedureLabel);
  }
  if (payload.clinicianAssessment !== undefined) {
    record.clinicianAssessment = text(payload.clinicianAssessment);
  }
  if (payload.treatmentPerformed !== undefined) {
    record.treatmentPerformed = text(payload.treatmentPerformed);
  }
  if (payload.aftercareInstructions !== undefined) {
    record.aftercareInstructions = text(payload.aftercareInstructions);
  }
  if (payload.performedAt !== undefined) record.performedAt = performedAt;
  if (payload.lotUsage !== undefined) {
    record.lotUsage = await normaliseLotUsage(payload.lotUsage, performedAt, ctx);
  }
  if (payload.aiDraftUsed !== undefined) record.aiDraftUsed = payload.aiDraftUsed === true;
  if (payload.aiDraftInferenceId !== undefined) {
    record.aiDraftInferenceId = text(payload.aiDraftInferenceId);
  }
  record.updatedBy = actorId(user);
  await record.save();
  await logClinicalAccess({
    context: ctx,
    user,
    action: "update",
    resourceType: "TreatmentRecord",
    resourceId: record._id,
    clinicalProfile: record.clinicalProfile,
    requestId,
  });
  return record.toObject();
}

function treatmentFingerprint(record) {
  const value = typeof record.toObject === "function" ? record.toObject() : record;
  const payload = {
    business: String(value.business),
    location: String(value.location),
    clinicalProfile: String(value.clinicalProfile),
    customer: String(value.customer),
    appointment: value.appointment ? String(value.appointment) : "",
    providerUser: String(value.providerUser),
    providerCredential: value.providerCredential ? String(value.providerCredential) : "",
    treatmentConsent: String(value.treatmentConsent),
    procedureKey: value.procedureKey,
    procedureLabel: value.procedureLabel,
    performedAt: new Date(value.performedAt).toISOString(),
    clinicianAssessment: value.clinicianAssessment,
    treatmentPerformed: value.treatmentPerformed,
    aftercareInstructions: value.aftercareInstructions,
    lotUsage: (value.lotUsage || []).map((item) => ({
      inventoryItem: String(item.inventoryItem),
      skuSnapshot: item.skuSnapshot,
      itemNameSnapshot: item.itemNameSnapshot,
      lotNumber: item.lotNumber,
      expiryAt: new Date(item.expiryAt).toISOString(),
      quantity: item.quantity,
      unit: item.unit,
    })),
    aiDraftUsed: value.aiDraftUsed === true,
    aiDraftInferenceId: value.aiDraftInferenceId || "",
    clinicianAttestation: value.clinicianAttestation || "",
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function signTreatmentRecord(
  recordId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const record = assertFound(
    await TreatmentRecord.findOne({
      _id: objectId(recordId, "treatmentRecord"),
      business: ctx.businessId,
      location: ctx.locationId,
      status: "draft",
    }),
    "Draft treatment record not found."
  );
  if (String(record.providerUser) !== String(actor)) {
    throw createServiceError(
      "Only the provider named on the treatment record may sign it.",
      403,
      { code: "CLINICAL_SIGNER_MUST_BE_PROVIDER" }
    );
  }
  const profile = await profileForBusiness(record.clinicalProfile, ctx);
  const consent = await assertCurrentConsent(
    profile,
    "clinical_treatment",
    record.procedureKey,
    ctx
  );
  const credential = await verifiedCredentialForActor(
    payload.providerCredentialId,
    record.procedureKey,
    ctx,
    user
  );
  const attestation = text(payload.clinicianAttestation);
  if (!attestation) {
    throw createServiceError(
      "Clinician attestation is required before signing a treatment record.",
      400,
      { field: "clinicianAttestation" }
    );
  }
  if (!text(record.treatmentPerformed)) {
    throw createServiceError(
      "A human-authored treatmentPerformed record is required before signing.",
      409,
      { code: "CLINICAL_TREATMENT_EVIDENCE_REQUIRED" }
    );
  }
  await normaliseLotUsage(
    record.lotUsage.map((item) => ({
      inventoryItem: item.inventoryItem,
      lotNumber: item.lotNumber,
      expiryAt: item.expiryAt,
      quantity: item.quantity,
      unit: item.unit,
    })),
    record.performedAt,
    ctx
  );

  record.treatmentConsent = consent._id;
  record.providerCredential = credential._id;
  record.clinicianAttestation = attestation;
  record.signedBy = actor;
  record.signedAt = new Date();
  record.status = "signed";
  record.updatedBy = actor;
  record.signedSnapshotFingerprint = treatmentFingerprint(record);
  await record.save();
  await logClinicalAccess({
    context: ctx,
    user,
    action: "sign",
    resourceType: "TreatmentRecord",
    resourceId: record._id,
    clinicalProfile: record.clinicalProfile,
    requestId,
    metadata: {
      providerCredentialId: String(credential._id),
      signedSnapshotFingerprint: record.signedSnapshotFingerprint,
      aiDraftUsed: record.aiDraftUsed === true,
      clinicianReviewRequired: true,
    },
  });
  return record.toObject();
}

export async function getTreatmentRecord(
  recordId,
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const record = assertFound(
    await TreatmentRecord.findOne({
      _id: objectId(recordId, "treatmentRecord"),
      business: ctx.businessId,
      location: ctx.locationId,
    }).lean(),
    "Treatment record not found."
  );
  await logClinicalAccess({
    context: ctx,
    user,
    action: "read",
    resourceType: "TreatmentRecord",
    resourceId: record._id,
    clinicalProfile: record.clinicalProfile,
    requestId,
  });
  return record;
}

export async function registerClinicalMedia(
  profileId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const profile = await profileForBusiness(profileId, ctx);
  const clinicalConsent = await assertCurrentConsent(
    profile,
    "clinical_photography",
    "",
    ctx
  );
  let marketingConsent = null;
  if (payload.marketingUseAllowed === true) {
    marketingConsent = await assertCurrentConsent(
      profile,
      "marketing_photography",
      "",
      ctx
    );
  }
  const storageKey = text(payload.storageKey);
  if (!storageKey || /^https?:\/\//i.test(storageKey)) {
    throw createServiceError(
      "Clinical media requires a private provider storageKey, not a public URL.",
      400,
      { field: "storageKey" }
    );
  }
  const contentSha256 = lower(payload.contentSha256);
  if (!/^[a-f0-9]{64}$/.test(contentSha256)) {
    throw createServiceError("contentSha256 must be a SHA-256 hex digest.", 400, {
      field: "contentSha256",
    });
  }
  const retentionDeleteAfter = date(
    payload.retentionDeleteAfter,
    "retentionDeleteAfter",
    { optional: false }
  );
  if (retentionDeleteAfter <= new Date()) {
    throw createServiceError("retentionDeleteAfter must be in the future.", 400, {
      field: "retentionDeleteAfter",
    });
  }
  const media = await ClinicalMedia.create({
    business: ctx.businessId,
    location: ctx.locationId,
    clinicalProfile: profile._id,
    customer: profile.customer,
    purpose: lower(payload.purpose || "clinical_documentation"),
    storageProvider: text(payload.storageProvider),
    storageKey,
    contentSha256,
    contentType: lower(payload.contentType),
    byteSize: Number(payload.byteSize),
    clinicalConsent: clinicalConsent._id,
    marketingConsent: marketingConsent?._id || null,
    marketingUseAllowed: Boolean(marketingConsent),
    retentionDeleteAfter,
    status: "active",
    capturedBy: actor,
    capturedAt: date(payload.capturedAt || new Date(), "capturedAt", {
      optional: false,
    }),
    metadata: cleanObject(payload.metadata),
  });
  const serialised = media.toObject();
  delete serialised.storageKey;
  await logClinicalAccess({
    context: ctx,
    user,
    action: "create",
    resourceType: "ClinicalMedia",
    resourceId: media._id,
    clinicalProfile: profile._id,
    purpose: media.purpose,
    requestId,
    metadata: {
      marketingUseAllowed: media.marketingUseAllowed,
      retentionDeleteAfter,
    },
  });
  return serialised;
}

export async function getClinicalMedia(
  mediaId,
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const media = assertFound(
    await ClinicalMedia.findOne({
      _id: objectId(mediaId, "clinicalMedia"),
      business: ctx.businessId,
      location: ctx.locationId,
      status: { $ne: "disposed" },
    }).lean(),
    "Clinical media record not found."
  );
  await logClinicalAccess({
    context: ctx,
    user,
    action: "read",
    resourceType: "ClinicalMedia",
    resourceId: media._id,
    clinicalProfile: media.clinicalProfile,
    purpose: media.purpose,
    requestId,
  });
  return media;
}

export async function confirmClinicalMediaDisposed(
  mediaId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  if (payload.storageDeletionConfirmed !== true) {
    throw createServiceError(
      "storageDeletionConfirmed=true is required after provider-side deletion.",
      400,
      { field: "storageDeletionConfirmed" }
    );
  }
  const media = assertFound(
    await ClinicalMedia.findOne({
      _id: objectId(mediaId, "clinicalMedia"),
      business: ctx.businessId,
      location: ctx.locationId,
      status: { $ne: "disposed" },
    }),
    "Clinical media record not found."
  );
  if (media.retentionDeleteAfter > new Date() && payload.earlyDisposalReason === undefined) {
    throw createServiceError(
      "Clinical media is not yet retention-due. Record an explicit earlyDisposalReason if lawful early deletion has been completed.",
      409
    );
  }
  media.status = "disposed";
  media.disposedAt = new Date();
  media.disposedBy = actor;
  media.metadata = {
    ...(media.metadata || {}),
    storageDeletionEvidence: cleanObject(payload.storageDeletionEvidence),
    earlyDisposalReason: text(payload.earlyDisposalReason),
  };
  await media.save();
  const serialised = media.toObject();
  delete serialised.storageKey;
  await logClinicalAccess({
    context: ctx,
    user,
    action: "dispose",
    resourceType: "ClinicalMedia",
    resourceId: media._id,
    clinicalProfile: media.clinicalProfile,
    purpose: media.purpose,
    requestId,
  });
  return serialised;
}

export async function createPrescriptionReference(
  profileId,
  payload = {},
  { context = {}, user, requestId = "" } = {}
) {
  const ctx = clinicalContext(context);
  const actor = actorId(user);
  const profile = await profileForBusiness(profileId, ctx);
  const credential = await verifiedCredentialForActor(
    payload.providerCredentialId,
    "prescription_reference",
    ctx,
    user
  );
  const connectorKey = lower(payload.connectorKey);
  const externalReference = text(payload.externalReference);
  if (!connectorKey || !externalReference) {
    throw createServiceError(
      "connectorKey and externalReference are required. Prescribing must occur in the approved external provider.",
      400
    );
  }
  let treatmentRecord = null;
  if (payload.treatmentRecordId) {
    treatmentRecord = assertFound(
      await TreatmentRecord.findOne({
        _id: objectId(payload.treatmentRecordId, "treatmentRecord"),
        business: ctx.businessId,
        location: ctx.locationId,
        clinicalProfile: profile._id,
        status: "signed",
      }).select("_id"),
      "Signed treatment record not found for this prescription reference."
    );
  }
  const reference = await PrescriptionReference.create({
    business: ctx.businessId,
    location: ctx.locationId,
    clinicalProfile: profile._id,
    customer: profile.customer,
    treatmentRecord: treatmentRecord?._id || null,
    providerCredential: credential._id,
    connectorKey,
    externalReferenceHash: createHash("sha256")
      .update(externalReference)
      .digest("hex"),
    externalStatus: text(payload.externalStatus),
    status: lower(payload.status || "active"),
    issuedAt: date(payload.issuedAt, "issuedAt"),
    expiresAt: date(payload.expiresAt, "expiresAt"),
    recordedBy: actor,
    metadata: {
      ...cleanObject(payload.metadata),
      prescribingLogicInAiibp: false,
      connectorOnly: true,
    },
  });
  await logClinicalAccess({
    context: ctx,
    user,
    action: "create",
    resourceType: "PrescriptionReference",
    resourceId: reference._id,
    clinicalProfile: profile._id,
    requestId,
    metadata: {
      connectorKey,
      externalReferenceStoredPlaintext: false,
    },
  });
  return reference.toObject();
}

export async function listClinicalAccessLogs(
  query = {},
  { context = {} } = {}
) {
  const ctx = clinicalContext(context);
  const match = { business: ctx.businessId };
  if (query.clinicalProfile) {
    match.clinicalProfile = objectId(query.clinicalProfile, "clinicalProfile");
  }
  if (query.resourceType) match.resourceType = text(query.resourceType);
  return ClinicalAccessLog.find(match)
    .populate("actor", "name email")
    .sort({ occurredAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(500, Number(query.limit) || 100)))
    .lean();
}

export default {
  confirmClinicalMediaDisposed,
  createClinicalIntake,
  createClinicalProfile,
  createPrescriptionReference,
  createProviderCredential,
  createTreatmentRecord,
  getClinicalMedia,
  getClinicalProfile,
  getTreatmentRecord,
  listClinicalAccessLogs,
  listClinicalConsents,
  listClinicalProfiles,
  listProviderCredentials,
  recordClinicalConsent,
  registerClinicalMedia,
  reviewClinicalIntake,
  signTreatmentRecord,
  submitClinicalIntake,
  updateClinicalIntake,
  updateTreatmentRecord,
  verifyProviderCredential,
};
