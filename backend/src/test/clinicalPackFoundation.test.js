import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Clinical Pack fails closed without explicit tenant/region/location eligibility", async () => {
  const [eligibility, middleware] = await Promise.all([
    source("../models/ClinicalCapabilityEligibility.js"),
    source("../features/clinical/clinicalEligibilityMiddleware.js"),
  ]);

  assert.match(eligibility, /default:\s*"suspended"/);
  assert.match(eligibility, /regionKey/);
  assert.match(eligibility, /allowedLocations/);
  assert.match(middleware, /status:\s*"eligible"/);
  assert.match(middleware, /hierarchy\.regionKey/);
  assert.match(middleware, /CLINICAL_PACK_NOT_ELIGIBLE/);
  assert.match(middleware, /CLINICAL_REGION_REQUIRED/);
});

test("clinical profiles fail closed to the selected home Location", async () => {
  const [middleware, routes] = await Promise.all([
    source("../features/clinical/clinicalEligibilityMiddleware.js"),
    source("../features/clinical/clinicalRoutes.js"),
  ]);

  assert.match(middleware, /requireClinicalProfileLocation/);
  assert.match(middleware, /homeLocation:\s*request\.clinicalContext\.locationId/);
  assert.match(middleware, /CLINICAL_PROFILE_LOCATION_RESTRICTED/);
  assert.match(routes, /router\.param\([\s\S]*"profileId"[\s\S]*requireClinicalProfileLocation/);
});

test("clinical permissions are separate and eligibility authority is non-delegable", async () => {
  const permissions = await source("../constants/permissions.js");

  for (const permission of [
    "clinical:record:read",
    "clinical:record:write",
    "clinical:record:sign",
    "clinical:consent:read",
    "clinical:consent:manage",
    "clinical:credential:read",
    "clinical:credential:manage",
    "clinical:media:read",
    "clinical:media:manage",
    "clinical:eligibility:manage",
  ]) {
    assert.match(permissions, new RegExp(`"${permission.replaceAll(":", "\\:")}"`));
  }
  assert.match(
    permissions,
    /NON_DELEGABLE_EMPLOYEE_PERMISSIONS[\s\S]*"clinical:eligibility:manage"/
  );
});

test("clinical consent and access evidence are append-only", async () => {
  const [consent, access] = await Promise.all([
    source("../models/ClinicalConsentRecord.js"),
    source("../models/ClinicalAccessLog.js"),
  ]);

  assert.match(consent, /CLINICAL_CONSENT_IMMUTABLE/);
  assert.match(consent, /marketing_photography/);
  assert.match(consent, /clinical_photography/);
  assert.match(consent, /clinical_treatment/);
  assert.match(access, /CLINICAL_ACCESS_LOG_IMMUTABLE/);
  assert.match(access, /resourceType/);
  assert.match(access, /clinicalProfile/);
});

test("signed treatment records require human provider scope, current consent and immutable provenance", async () => {
  const [record, service] = await Promise.all([
    source("../models/TreatmentRecord.js"),
    source("../features/clinical/clinicalRecordsService.js"),
  ]);

  assert.match(record, /CLINICAL_SIGNATURE_EVIDENCE_REQUIRED/);
  assert.match(record, /SIGNED_TREATMENT_RECORD_IMMUTABLE/);
  assert.match(record, /TREATMENT_RECORD_QUERY_MUTATION_PROHIBITED/);
  assert.match(record, /findOneAndUpdate/);
  assert.match(record, /deleteOne/);
  assert.match(record, /CLINICAL_AI_DRAFT_PROVENANCE_REQUIRED/);
  assert.match(service, /verifiedCredentialForActor/);
  assert.match(service, /clinical_treatment/);
  assert.match(service, /Only the provider named on the treatment record may sign it/);
  assert.match(service, /clinicianAttestation/);
  assert.match(service, /signedSnapshotFingerprint/);
  assert.match(service, /human-authored treatmentPerformed/);
});

test("clinical lot usage excludes unowned/location-ambiguous inventory and expired lots", async () => {
  const service = await source("../features/clinical/clinicalRecordsService.js");

  assert.match(service, /InventoryItem\.find\(\{/);
  assert.match(service, /business:\s*ctx\.businessId/);
  assert.match(service, /location:\s*ctx\.locationId/);
  assert.match(service, /CLINICAL_INVENTORY_OWNERSHIP_REQUIRED/);
  assert.match(service, /CLINICAL_EXPIRED_LOT_PROHIBITED/);
  assert.match(service, /skuSnapshot/);
  assert.match(service, /lotNumber/);
  assert.match(service, /expiryAt/);
});

test("clinical media requires purpose-specific consent, private storage and explicit retention", async () => {
  const [media, service] = await Promise.all([
    source("../models/ClinicalMedia.js"),
    source("../features/clinical/clinicalRecordsService.js"),
  ]);

  assert.match(media, /CLINICAL_MEDIA_MARKETING_CONSENT_REQUIRED/);
  assert.match(media, /retentionDeleteAfter/);
  assert.match(media, /select:\s*false/);
  assert.match(service, /clinical_photography/);
  assert.match(service, /marketing_photography/);
  assert.match(service, /private provider storageKey, not a public URL/);
  assert.match(service, /storageDeletionConfirmed=true/);
});

test("prescription support is connector-reference only and contains no prescribing logic", async () => {
  const [model, service] = await Promise.all([
    source("../models/PrescriptionReference.js"),
    source("../features/clinical/clinicalRecordsService.js"),
  ]);

  assert.match(model, /externalReferenceHash/);
  assert.match(model, /connectorKey/);
  assert.match(service, /"prescription_reference"/);
  assert.match(service, /prescribingLogicInAiibp:\s*false/);
  assert.match(service, /connectorOnly:\s*true/);
  assert.doesNotMatch(service, /prescribeMedication|doseRecommendation|diagnos/i);
});

test("clinical routes separate record, consent, credential and media permissions", async () => {
  const routes = await source("../features/clinical/clinicalRoutes.js");

  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /requireClinicalEligibility/);
  assert.match(routes, /"clinical:record:sign"/);
  assert.match(routes, /"clinical:consent:manage"/);
  assert.match(routes, /"clinical:credential:manage"/);
  assert.match(routes, /"clinical:media:manage"/);
  assert.match(routes, /"clinical:eligibility:manage"/);
});
