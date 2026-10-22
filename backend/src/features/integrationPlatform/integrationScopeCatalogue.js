export const INTEGRATION_SCOPES = Object.freeze([
  "integration:read",
  "events:read",
  "customer:read",
  "customer:write",
  "appointment:read",
  "appointment:write",
  "service:read",
  "membership:read",
  "membership:write",
  "payment:read",
  "payment:write",
  "inventory:read",
  "inventory:write",
  "communications:read",
  "communications:write",
]);

const SCOPE_SET = new Set(INTEGRATION_SCOPES);
const SCOPE_DOMAIN_SET = new Set(
  INTEGRATION_SCOPES.map((scope) => scope.split(":")[0])
);

function wildcardScopeSupported(scope) {
  if (!scope.endsWith(":*")) return false;
  return SCOPE_DOMAIN_SET.has(scope.slice(0, -2));
}

export function normaliseIntegrationScopes(scopes = []) {
  const values = [
    ...new Set(
      (Array.isArray(scopes) ? scopes : [])
        .map((scope) => String(scope || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const invalid = values.filter(
    (scope) =>
      scope !== "*" &&
      !SCOPE_SET.has(scope) &&
      !wildcardScopeSupported(scope)
  );

  if (invalid.length > 0) {
    const error = new Error(
      `Unsupported integration scope: ${invalid.join(", ")}.`
    );
    error.code = "INVALID_INTEGRATION_SCOPE";
    error.status = 400;
    error.statusCode = 400;
    error.details = {
      invalidScopes: invalid,
      allowedScopes: INTEGRATION_SCOPES,
    };
    throw error;
  }

  return Object.freeze(values);
}

export function integrationScopeCatalogue() {
  return INTEGRATION_SCOPES.map((scope) => {
    const [domain, access] = scope.split(":");
    return Object.freeze({
      scope,
      domain,
      access,
      version: "1",
    });
  });
}

export default Object.freeze({
  INTEGRATION_SCOPES,
  integrationScopeCatalogue,
  normaliseIntegrationScopes,
});
