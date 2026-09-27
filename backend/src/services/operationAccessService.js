import {
  assertBusinessResourceAuthority,
  assertEffectivePermission,
  assertLocationResourceAuthority,
} from "./effectiveAuthorityService.js";

function accessError(
  message,
  code,
  statusCode = 403
) {
  const error = new Error(
    message
  );
  error.code = code;
  error.statusCode =
    statusCode;
  return error;
}

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

export function assertTrustedCapabilityDecision(
  decision
) {
  if (decision === undefined || decision === null) {
    return null;
  }

  if (
    !decision ||
    typeof decision !== "object" ||
    Array.isArray(decision)
  ) {
    throw accessError(
      "Trusted capability evaluation is unavailable.",
      "INVALID_CAPABILITY_DECISION",
      500
    );
  }

  const key =
    text(
      decision.key ||
        decision.capability
    );

  if (!key) {
    throw accessError(
      "Trusted capability evaluation is unavailable.",
      "INVALID_CAPABILITY_DECISION",
      500
    );
  }

  if (
    decision.allowed !==
    true
  ) {
    throw accessError(
      "The requested capability is unavailable.",
      "CAPABILITY_UNAVAILABLE",
      404
    );
  }

  return Object.freeze({
    key,
    allowed:
      true,
    source:
      text(
        decision.source
      ) || null,
  });
}

export function assertOperationAccess({
  authority,
  permission,
  capabilityDecision = null,
  resource = null,
} = {}) {
  const permissionGrant =
    assertEffectivePermission(
      authority,
      permission
    );

  const capabilityGrant =
    assertTrustedCapabilityDecision(
      capabilityDecision
    );

  let resourceGrant =
    null;

  if (
    resource !==
      undefined &&
    resource !==
      null
  ) {
    if (
      !resource ||
      typeof resource !==
        "object" ||
      Array.isArray(
        resource
      )
    ) {
      throw accessError(
        "Resource ownership metadata is unavailable.",
        "INVALID_RESOURCE_AUTHORITY_INPUT",
        500
      );
    }

    if (
      resource.locationId
    ) {
      resourceGrant =
        assertLocationResourceAuthority(
          authority,
          {
            businessId:
              resource.businessId,
            locationId:
              resource.locationId,
            requireSelectedLocation:
              resource.requireSelectedLocation ===
              true,
          }
        );
    } else {
      resourceGrant =
        assertBusinessResourceAuthority(
          authority,
          resource.businessId
        );
    }
  }

  return Object.freeze({
    permission:
      permissionGrant.permission,
    permissionScope:
      permissionGrant.scope,
    capability:
      capabilityGrant,
    resource:
      resourceGrant
        ? Object.freeze({
            ...resourceGrant,
          })
        : null,
  });
}

export default {
  assertOperationAccess,
  assertTrustedCapabilityDecision,
};
