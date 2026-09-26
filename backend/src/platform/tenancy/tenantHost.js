import {
  domainToASCII,
} from "node:url";
import {
  isIP,
} from "node:net";

function hostError(
  message,
  code = "INVALID_TENANT_HOST",
  statusCode = 400
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export function normaliseTenantHost(value) {
  if (Array.isArray(value)) {
    throw hostError(
      "Tenant host must be a single hostname."
    );
  }

  let candidate =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!candidate) {
    throw hostError(
      "Tenant host is required."
    );
  }

  if (
    candidate.includes("/") ||
    candidate.includes("\\") ||
    candidate.includes("@") ||
    candidate.includes("?") ||
    candidate.includes("#") ||
    /\s/.test(candidate)
  ) {
    throw hostError(
      "Tenant host must contain a hostname only."
    );
  }

  if (candidate.endsWith(".")) {
    candidate =
      candidate.slice(0, -1);
  }

  const colonCount =
    (candidate.match(/:/g) || [])
      .length;

  if (colonCount === 1) {
    const [hostname, port] =
      candidate.split(":");

    if (
      port &&
      /^\d{1,5}$/.test(port)
    ) {
      const numericPort =
        Number(port);

      if (
        numericPort < 1 ||
        numericPort > 65535
      ) {
        throw hostError(
          "Tenant host contains an invalid port."
        );
      }

      candidate = hostname;
    }
  } else if (colonCount > 1) {
    throw hostError(
      "IP-address tenant hosts are not supported."
    );
  }

  if (isIP(candidate)) {
    throw hostError(
      "IP-address tenant hosts are not supported."
    );
  }

  const ascii =
    domainToASCII(candidate);

  if (
    !ascii ||
    ascii.length > 253 ||
    !ascii.includes(".")
  ) {
    throw hostError(
      "Tenant host must be a valid fully-qualified domain name."
    );
  }

  const labels =
    ascii.split(".");

  for (const label of labels) {
    if (
      !label ||
      label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    ) {
      throw hostError(
        "Tenant host contains an invalid domain label."
      );
    }
  }

  return ascii;
}

export function extractServerTrustedHost(
  request,
  {
    trustForwardedHost = false,
  } = {}
) {
  if (
    request?.trustedPublicHost !==
      undefined &&
    request?.trustedPublicHost !==
      null &&
    String(
      request.trustedPublicHost
    ).trim()
  ) {
    return normaliseTenantHost(
      request.trustedPublicHost
    );
  }

  let rawHost =
    request?.headers?.host;

  if (
    trustForwardedHost === true &&
    request?.headers?.[
      "x-forwarded-host"
    ]
  ) {
    rawHost =
      String(
        request.headers[
          "x-forwarded-host"
        ]
      )
        .split(",")[0]
        .trim();
  }

  return normaliseTenantHost(
    rawHost
  );
}

export default normaliseTenantHost;
