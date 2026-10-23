import ClinicalCapabilityEligibility from "../../models/ClinicalCapabilityEligibility.js";
import ClinicalProfile from "../../models/ClinicalProfile.js";
import Location from "../../models/Location.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function businessId(request) {
  return (
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null
  );
}

function locationId(request) {
  return (
    request.effectiveAuthority?.locationId ||
    request.tenantContext?.locationId ||
    null
  );
}

export async function requireClinicalEligibility(request, _response, next) {
  try {
    const business = businessId(request);
    const location = locationId(request);
    if (!business || !location) {
      throw createServiceError(
        "Clinical Pack requires a trusted active Business and selected Location.",
        403,
        { code: "CLINICAL_LOCATION_AUTHORITY_REQUIRED" }
      );
    }

    const locationRecord = await Location.findOne({
      _id: location,
      business,
      status: "active",
    })
      .select("_id business hierarchy.regionKey status")
      .lean();
    if (!locationRecord) {
      throw createServiceError(
        "The selected clinical Location is not active for this Business.",
        403,
        { code: "CLINICAL_LOCATION_NOT_ACTIVE" }
      );
    }

    const regionKey = String(locationRecord.hierarchy?.regionKey || "")
      .trim()
      .toLowerCase();
    if (!regionKey) {
      throw createServiceError(
        "Clinical Pack cannot run until the selected Location has an explicit regionKey.",
        409,
        { code: "CLINICAL_REGION_REQUIRED" }
      );
    }

    const now = new Date();
    const eligibility = await ClinicalCapabilityEligibility.findOne({
      business,
      regionKey,
      status: "eligible",
      validFrom: { $lte: now },
      $and: [
        {
          $or: [
            { validUntil: null },
            { validUntil: { $gt: now } },
          ],
        },
        {
          $or: [
            { allowedLocations: { $size: 0 } },
            { allowedLocations: locationRecord._id },
          ],
        },
      ],
    }).lean();

    if (!eligibility) {
      throw createServiceError(
        "Clinical Pack is disabled for this Business/region/location.",
        403,
        { code: "CLINICAL_PACK_NOT_ELIGIBLE" }
      );
    }

    request.clinicalContext = Object.freeze({
      businessId: String(business),
      locationId: String(locationRecord._id),
      regionKey,
      eligibilityId: String(eligibility._id),
      policyVersion: eligibility.policyVersion,
      jurisdictionReference: eligibility.jurisdictionReference,
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireClinicalProfileLocation(request, _response, next) {
  try {
    const profileId = String(request.params?.profileId || "").trim();
    if (!profileId) return next();
    if (!request.clinicalContext) {
      throw createServiceError("Clinical eligibility context is required.", 403);
    }

    const profile = await ClinicalProfile.findOne({
      _id: profileId,
      business: request.clinicalContext.businessId,
      homeLocation: request.clinicalContext.locationId,
      status: "active",
    })
      .select("_id business customer homeLocation status")
      .lean();
    if (!profile) {
      throw createServiceError(
        "Clinical profile is not available at the selected Location. Cross-location clinical visibility requires an explicit future sharing policy.",
        404,
        { code: "CLINICAL_PROFILE_LOCATION_RESTRICTED" }
      );
    }

    request.clinicalProfileAuthority = Object.freeze({
      profileId: String(profile._id),
      customerId: String(profile.customer),
      homeLocationId: String(profile.homeLocation),
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

export default requireClinicalEligibility;
