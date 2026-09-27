import {
  createPublicTenantContextMiddleware,
} from "../platform/tenancy/publicTenantContext.js";
import {
  extractServerTrustedHost,
  normaliseTenantHost,
} from "../platform/tenancy/tenantHost.js";

function rawHostname(
  request
) {
  return String(
    request
      ?.headers
      ?.host ||
      ""
  )
    .trim()
    .toLowerCase()
    .split(":")[0];
}

export function resolveServicePublicTenantHost(
  request,
  environment = process.env
) {
  const explicitOverride =
    String(
      environment
        .SERVICE_PUBLIC_TENANT_HOST_OVERRIDE ||
        ""
    ).trim();

  if (
    explicitOverride
  ) {
    return normaliseTenantHost(
      explicitOverride
    );
  }

  const host =
    rawHostname(
      request
    );

  if (
    environment.NODE_ENV !==
      "production" &&
    [
      "localhost",
      "127.0.0.1",
    ].includes(
      host
    )
  ) {
    const canonicalAppHost =
      String(
        environment
          .SALONAI_CANONICAL_APP_DOMAIN ||
          ""
      ).trim();

    if (
      canonicalAppHost
    ) {
      return normaliseTenantHost(
        canonicalAppHost
      );
    }
  }

  return extractServerTrustedHost(
    request
  );
}

export const servicePublicTenantContextMiddleware =
  createPublicTenantContextMiddleware({
    hostResolver:
      resolveServicePublicTenantHost,
  });

export default servicePublicTenantContextMiddleware;
