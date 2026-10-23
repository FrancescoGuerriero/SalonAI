import {
  createServiceError,
} from "../../shared/serviceError.js";
import * as service from "./partnerMarketplaceService.js";

function requestId(request) {
  return (
    request.id ||
    request.requestId ||
    request.headers?.["x-request-id"] ||
    ""
  );
}

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!value) {
    throw createServiceError("Trusted tenant authority is required.", 403, {
      code: "MARKETPLACE_TENANT_AUTHORITY_REQUIRED",
    });
  }
  return String(value);
}

export async function catalogue(request, response) {
  response.json(
    await service.listPartnerMarketplaceApps(request.query || {}, {
      platformReview: false,
    })
  );
}

export async function submissions(request, response) {
  response.json(
    await service.listPartnerMarketplaceApps(request.query || {}, {
      platformReview: true,
    })
  );
}

export async function submit(request, response) {
  response.status(201).json(
    await service.submitPartnerMarketplaceApp(request.body || {}, {
      user: request.user,
      requestId: requestId(request),
    })
  );
}

export async function review(request, response) {
  response.json(
    await service.reviewPartnerMarketplaceApp(
      request.params.appId,
      request.body || {},
      {
        user: request.user,
        requestId: requestId(request),
      }
    )
  );
}

export async function installations(request, response) {
  response.json(
    await service.listPartnerMarketplaceInstallations(request.query || {}, {
      businessId: businessId(request),
    })
  );
}

export async function prepareInstallation(request, response) {
  response.status(201).json(
    await service.preparePartnerMarketplaceInstallation(
      request.params.appId,
      request.body || {},
      {
        businessId: businessId(request),
        user: request.user,
        requestId: requestId(request),
      }
    )
  );
}

export default {
  catalogue,
  installations,
  prepareInstallation,
  review,
  submissions,
  submit,
};
