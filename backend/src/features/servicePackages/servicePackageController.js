import * as service from "./servicePackageService.js";

export async function listPublishedDefinitions(
  request,
  response
) {
  return response.json({
    items:
      await service.listPublishedServicePackages(),
  });
}

export async function myEntitlements(
  request,
  response
) {
  return response.json({
    items:
      await service.listMyServicePackages(
        request.user,
        request.query || {}
      ),
  });
}

export async function listDefinitions(
  request,
  response
) {
  return response.json({
    items:
      await service.listServicePackages(
        request.query || {}
      ),
  });
}

export async function createDefinition(
  request,
  response
) {
  const item =
    await service.createServicePackage(
      request.body || {},
      request.user || null
    );

  return response
    .status(201)
    .json({
      success: true,
      message:
        "Service package created.",
      item,
    });
}

export async function updateDefinition(
  request,
  response
) {
  const item =
    await service.updateServicePackage(
      request.params.id,
      request.body || {},
      request.user || null
    );

  return response.json({
    success: true,
    message:
      "Service package updated.",
    item,
  });
}

export async function grantEntitlement(
  request,
  response
) {
  const entitlement =
    await service.grantServicePackage(
      request.params.id,
      request.body || {},
      request.user || null
    );

  return response
    .status(201)
    .json({
      success: true,
      message:
        "Service package granted to customer.",
      entitlement,
    });
}

export async function customerEntitlements(
  request,
  response
) {
  return response.json({
    items:
      await service.listCustomerPackages(
        request.params.customerId,
        request.query || {}
      ),
  });
}

export async function entitlementRedemptions(
  request,
  response
) {
  return response.json({
    items:
      await service.listPackageRedemptions(
        request.params.entitlementId
      ),
  });
}

export async function redeemEntitlement(
  request,
  response
) {
  const result =
    await service.redeemServicePackage(
      request.params.entitlementId,
      request.body || {},
      request.user || null
    );

  return response.json({
    success: true,
    message:
      "Package session redeemed for appointment.",
    ...result,
  });
}

export async function reverseRedemption(
  request,
  response
) {
  const result =
    await service.reverseServicePackageRedemption(
      request.params.redemptionId,
      request.body || {},
      request.user || null
    );

  return response.json({
    success: true,
    message:
      "Package redemption reversed.",
    ...result,
  });
}
