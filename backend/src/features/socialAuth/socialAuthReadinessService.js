import {
  SOCIAL_AUTH_PROVIDERS,
} from "../../models/SocialIdentity.js";

const SOCIAL_AUTH_PROVIDER_LABELS =
  Object.freeze({
    google: "Google",
    facebook: "Facebook",
    microsoft: "Microsoft",
    yahoo: "Yahoo",
    linkedin: "LinkedIn",
  });

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function callbackPath(
  provider
) {
  return `/api/auth/social/${provider}/callback`;
}

function providerEnvironmentPrefix(
  provider
) {
  return `SOCIAL_${provider.toUpperCase()}_`;
}

function parseRedirectUri(
  value
) {
  try {
    return new URL(
      value
    );
  } catch {
    return null;
  }
}

function isLoopbackHostname(
  hostname
) {
  return [
    "localhost",
    "127.0.0.1",
    "::1",
  ].includes(
    String(
      hostname || ""
    ).toLowerCase()
  );
}

function providerReport(
  definition,
  environment,
  isProduction
) {
  const {
    provider,
    label,
  } = definition;

  const prefix =
    providerEnvironmentPrefix(
      provider
    );

  const clientIdConfigured =
    Boolean(
      text(
        environment[
          `${prefix}CLIENT_ID`
        ]
      )
    );

  const clientSecretConfigured =
    Boolean(
      text(
        environment[
          `${prefix}CLIENT_SECRET`
        ]
      )
    );

  const redirectUri =
    text(
      environment[
        `${prefix}REDIRECT_URI`
      ]
    );

  const parsedRedirect =
    redirectUri
      ? parseRedirectUri(
          redirectUri
        )
      : null;

  const expectedCallbackPath =
    callbackPath(
      provider
    );

  const facebookGraphVersion =
    text(
      environment
        .FACEBOOK_GRAPH_VERSION
    );

  const checks = {
    clientIdConfigured,
    clientSecretConfigured,
    redirectUriConfigured:
      Boolean(
        redirectUri
      ),
    redirectUriValid:
      Boolean(
        parsedRedirect
      ),
    callbackPathMatches:
      parsedRedirect
        ?.pathname ===
      expectedCallbackPath,
    redirectHasNoCredentials:
      Boolean(
        parsedRedirect
      ) &&
      !parsedRedirect.username &&
      !parsedRedirect.password,
    redirectHasNoQueryOrHash:
      Boolean(
        parsedRedirect
      ) &&
      !parsedRedirect.search &&
      !parsedRedirect.hash,
    productionHttps:
      !isProduction ||
      parsedRedirect
        ?.protocol ===
        "https:",
    productionNotLoopback:
      !isProduction ||
      (
        Boolean(
          parsedRedirect
        ) &&
        !isLoopbackHostname(
          parsedRedirect.hostname
        )
      ),
    facebookGraphVersionConfigured:
      provider !==
        "facebook" ||
      /^v\d+\.\d+$/.test(
        facebookGraphVersion
      ),
  };

  const blockers =
    Object.entries(
      checks
    )
      .filter(
        ([, passed]) =>
          passed !== true
      )
      .map(
        ([name]) =>
          name
      );

  return {
    provider,
    label,
    ready:
      blockers.length ===
      0,
    checks,
    blockers,
    redirect: {
      expectedPath:
        expectedCallbackPath,
      configured:
        Boolean(
          redirectUri
        ),
      protocol:
        parsedRedirect
          ?.protocol || "",
      path:
        parsedRedirect
          ?.pathname || "",
    },
  };
}

export function buildSocialAuthReadinessReport(
  {
    environment =
      process.env,
  } = {}
) {
  const isProduction =
    text(
      environment
        .NODE_ENV
    ).toLowerCase() ===
    "production";

  const providers =
    SOCIAL_AUTH_PROVIDERS.map(
      (provider) =>
        providerReport(
          {
            provider,
            label:
              SOCIAL_AUTH_PROVIDER_LABELS[
                provider
              ] ||
              provider,
          },
          environment,
          isProduction
        )
    );

  const blockedProviders =
    providers
      .filter(
        (provider) =>
          provider.ready !==
          true
      )
      .map(
        (provider) =>
          provider.provider
      );

  const nextSteps =
    providers
      .filter(
        (provider) =>
          provider.ready !==
          true
      )
      .map(
        (provider) =>
          `Complete ${provider.label} OAuth configuration for ${provider.redirect.expectedPath}. Blocking checks: ${provider.blockers.join(", ")}.`
      );

  if (
    blockedProviders.length ===
    0
  ) {
    nextSteps.push(
      "Run a controlled browser acceptance test for each provider. This readiness audit does not contact an identity provider."
    );
  }

  return {
    environment:
      isProduction
        ? "production"
        : "non-production",
    readyForAcceptance:
      blockedProviders.length ===
      0,
    providerCount:
      providers.length,
    blockedProviders,
    providers,
    nextSteps,
    readOnly: true,
    providerRequestsPerformed:
      false,
    databaseWritesRequested:
      false,
  };
}

export default {
  buildSocialAuthReadinessReport,
};
