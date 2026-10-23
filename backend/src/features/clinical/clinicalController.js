import * as eligibilityService from "./clinicalEligibilityService.js";
import * as recordsService from "./clinicalRecordsService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function tenant(request) {
  const businessId =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!businessId) {
    throw createServiceError("Trusted tenant authority is required.", 403);
  }
  return {
    businessId,
    user: request.user,
    requestId:
      request.id ||
      request.requestId ||
      request.headers?.["x-request-id"] ||
      "",
  };
}

function clinical(request) {
  if (!request.clinicalContext) {
    throw createServiceError("Clinical eligibility context is required.", 403);
  }
  return {
    context: request.clinicalContext,
    user: request.user,
    requestId:
      request.id ||
      request.requestId ||
      request.headers?.["x-request-id"] ||
      "",
  };
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function eligibility(request, response) {
  response.json({
    items: await eligibilityService.listClinicalEligibility(
      request.query || {},
      tenant(request)
    ),
    defaultEnabled: false,
  });
}

export async function configureEligibility(request, response) {
  response.status(200).json({
    eligibility: await eligibilityService.upsertClinicalEligibility(
      {
        ...body(request),
        regionKey: request.params.regionKey || body(request).regionKey,
      },
      tenant(request)
    ),
    defaultEnabled: false,
  });
}

export async function profiles(request, response) {
  response.json({
    items: await recordsService.listClinicalProfiles(
      request.query || {},
      clinical(request)
    ),
  });
}

export async function createProfile(request, response) {
  response.status(201).json({
    profile: await recordsService.createClinicalProfile(
      body(request),
      clinical(request)
    ),
  });
}

export async function profile(request, response) {
  response.json({
    profile: await recordsService.getClinicalProfile(
      request.params.profileId,
      clinical(request)
    ),
  });
}

export async function consents(request, response) {
  response.json({
    items: await recordsService.listClinicalConsents(
      request.params.profileId,
      request.query || {},
      clinical(request)
    ),
  });
}

export async function recordConsent(request, response) {
  response.status(201).json({
    consent: await recordsService.recordClinicalConsent(
      request.params.profileId,
      body(request),
      clinical(request)
    ),
  });
}

export async function createIntake(request, response) {
  response.status(201).json({
    intake: await recordsService.createClinicalIntake(
      request.params.profileId,
      body(request),
      clinical(request)
    ),
  });
}

export async function updateIntake(request, response) {
  response.json({
    intake: await recordsService.updateClinicalIntake(
      request.params.intakeId,
      body(request),
      clinical(request)
    ),
  });
}

export async function submitIntake(request, response) {
  response.json({
    intake: await recordsService.submitClinicalIntake(
      request.params.intakeId,
      clinical(request)
    ),
  });
}

export async function reviewIntake(request, response) {
  response.json({
    intake: await recordsService.reviewClinicalIntake(
      request.params.intakeId,
      body(request),
      clinical(request)
    ),
  });
}

export async function credentials(request, response) {
  response.json({
    items: await recordsService.listProviderCredentials(
      request.query || {},
      clinical(request)
    ),
  });
}

export async function createCredential(request, response) {
  response.status(201).json({
    credential: await recordsService.createProviderCredential(
      body(request),
      clinical(request)
    ),
  });
}

export async function verifyCredential(request, response) {
  response.json({
    credential: await recordsService.verifyProviderCredential(
      request.params.credentialId,
      body(request),
      clinical(request)
    ),
  });
}

export async function createTreatment(request, response) {
  response.status(201).json({
    treatment: await recordsService.createTreatmentRecord(
      request.params.profileId,
      body(request),
      clinical(request)
    ),
    clinicalAiAuthority: "none",
  });
}

export async function updateTreatment(request, response) {
  response.json({
    treatment: await recordsService.updateTreatmentRecord(
      request.params.recordId,
      body(request),
      clinical(request)
    ),
  });
}

export async function signTreatment(request, response) {
  response.json({
    treatment: await recordsService.signTreatmentRecord(
      request.params.recordId,
      body(request),
      clinical(request)
    ),
    signedByQualifiedHuman: true,
  });
}

export async function treatment(request, response) {
  response.json({
    treatment: await recordsService.getTreatmentRecord(
      request.params.recordId,
      clinical(request)
    ),
  });
}

export async function registerMedia(request, response) {
  response.status(201).json({
    media: await recordsService.registerClinicalMedia(
      request.params.profileId,
      body(request),
      clinical(request)
    ),
  });
}

export async function media(request, response) {
  response.json({
    media: await recordsService.getClinicalMedia(
      request.params.mediaId,
      clinical(request)
    ),
  });
}

export async function disposeMedia(request, response) {
  response.json({
    media: await recordsService.confirmClinicalMediaDisposed(
      request.params.mediaId,
      body(request),
      clinical(request)
    ),
  });
}

export async function createPrescriptionReference(request, response) {
  response.status(201).json({
    reference: await recordsService.createPrescriptionReference(
      request.params.profileId,
      body(request),
      clinical(request)
    ),
    prescribingLogicInAiibp: false,
  });
}

export async function accessLogs(request, response) {
  response.json({
    items: await recordsService.listClinicalAccessLogs(
      request.query || {},
      clinical(request)
    ),
  });
}

export default {
  accessLogs,
  configureEligibility,
  consents,
  createCredential,
  createIntake,
  createPrescriptionReference,
  createProfile,
  createTreatment,
  credentials,
  disposeMedia,
  eligibility,
  media,
  profile,
  profiles,
  recordConsent,
  registerMedia,
  reviewIntake,
  signTreatment,
  submitIntake,
  treatment,
  updateIntake,
  updateTreatment,
  verifyCredential,
};
