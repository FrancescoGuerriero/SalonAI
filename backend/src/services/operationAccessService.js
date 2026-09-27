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

function capabilityKey(value) {
  return text(
    value
  ).toLowerCase();
}

export function assertTrustedCapabilityDecision(
  decision,
  {
    authority,
  } = {}
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
    capabilityKey(
      decision.key ||
        decision.capability
    );
  const businessId =
    text(
      decision.businessId
    );

  if (
    !key ||
    !businessId ||
    !authority?.businessId
  ) {
    throw accessError(
      "Trusted capability evaluation is unavailable.",
      "INVALID_CAPABILITY_DECISION",
      500
    );
  }

  assertBusinessResourceAuthority(
    authority,
    businessId
  );

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
    businessId,
    allowed:
      true,
    source:
      text(
        decision.source
      ) || null,
    verticalId:
      text(
        decision.verticalId
      ) || null,
    manifestRevision:
      text(
        decision.manifestRevision
      ) || null,
  });
}

export function capabilityDecisionFromComposition({
  authority,
  composition,
  capability,
} = {}) {
  if (
    !composition ||
    typeof composition !== "object" ||
    Array.isArray(composition) ||
    !composition.manifest ||
    typeof composition.manifest !== "object" ||
    !Array.isArray(
      composition.capabilities
    )
  ) {
    throw accessError(
      "Effective tenant product composition is unavailable.",
      "INVALID_CAPABILITY_COMPOSITION",
      500
    );
  }

  const key =
    capabilityKey(
      capability
    );
  const businessId =
    text(
      composition.manifest
        .businessId
    );

  if (
    !key ||
    !businessId
  ) {
    throw accessError(
      "Effective tenant product composition is unavailable.",
      "INVALID_CAPABILITY_COMPOSITION",
      500
    );
  }

  assertBusinessResourceAuthority(
    authority,
    businessId
  );

  const state =
    composition.capabilities.find(
      (item) =>
        capabilityKey(
          item?.key
        ) === key
    );

  return assertTrustedCapabilityDecision(
    {
      key,
      businessId,
      allowed:
        state?.enabled ===
        true,
      source:
        state?.reason ||
        "not-selected",
      verticalId:
        composition.manifest
          .verticalId,
      manifestRevision:
        composition.manifest
          .manifestRevision,
    },
    {
      authority,
    }
  );
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
      capabilityDecision,
      {
        authority,
      }
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
  capabilityDecisionFromComposition,
};
