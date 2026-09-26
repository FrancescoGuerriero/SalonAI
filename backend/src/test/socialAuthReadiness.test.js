import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildSocialAuthReadinessReport,
} from "../features/socialAuth/socialAuthReadinessService.js";

function readyEnvironment() {
  return {
    NODE_ENV:
      "production",
    SOCIAL_GOOGLE_CLIENT_ID:
      "google-client-id",
    SOCIAL_GOOGLE_CLIENT_SECRET:
      "google-secret-value",
    SOCIAL_GOOGLE_REDIRECT_URI:
      "https://salon.example.com/api/auth/social/google/callback",
    SOCIAL_FACEBOOK_CLIENT_ID:
      "facebook-client-id",
    SOCIAL_FACEBOOK_CLIENT_SECRET:
      "facebook-secret-value",
    SOCIAL_FACEBOOK_REDIRECT_URI:
      "https://salon.example.com/api/auth/social/facebook/callback",
    FACEBOOK_GRAPH_VERSION:
      "v24.0",
    SOCIAL_MICROSOFT_CLIENT_ID:
      "microsoft-client-id",
    SOCIAL_MICROSOFT_CLIENT_SECRET:
      "microsoft-secret-value",
    SOCIAL_MICROSOFT_REDIRECT_URI:
      "https://salon.example.com/api/auth/social/microsoft/callback",
    SOCIAL_YAHOO_CLIENT_ID:
      "yahoo-client-id",
    SOCIAL_YAHOO_CLIENT_SECRET:
      "yahoo-secret-value",
    SOCIAL_YAHOO_REDIRECT_URI:
      "https://salon.example.com/api/auth/social/yahoo/callback",
  };
}

test(
  "social-auth readiness accepts four correctly configured production providers",
  () => {
    const report =
      buildSocialAuthReadinessReport({
        environment:
          readyEnvironment(),
      });

    assert.equal(
      report.readyForAcceptance,
      true
    );
    assert.equal(
      report.providerCount,
      4
    );
    assert.deepEqual(
      report.blockedProviders,
      []
    );

    for (
      const provider
      of report.providers
    ) {
      assert.equal(
        provider.ready,
        true,
        provider.provider
      );
      assert.deepEqual(
        provider.blockers,
        []
      );
    }
  }
);

test(
  "production social-auth readiness rejects insecure or incorrect callback URLs",
  () => {
    const environment =
      readyEnvironment();

    environment.SOCIAL_GOOGLE_REDIRECT_URI =
      "http://localhost:5000/api/auth/social/google/callback";

    environment.SOCIAL_YAHOO_REDIRECT_URI =
      "https://salon.example.com/api/auth/social/google/callback";

    const report =
      buildSocialAuthReadinessReport({
        environment,
      });

    assert.equal(
      report.readyForAcceptance,
      false
    );

    const google =
      report.providers.find(
        (provider) =>
          provider.provider ===
          "google"
      );

    const yahoo =
      report.providers.find(
        (provider) =>
          provider.provider ===
          "yahoo"
      );

    assert.equal(
      google.checks
        .productionHttps,
      false
    );
    assert.equal(
      google.checks
        .productionNotLoopback,
      false
    );
    assert.equal(
      yahoo.checks
        .callbackPathMatches,
      false
    );
  }
);

test(
  "Facebook readiness requires an explicit versioned Graph API configuration",
  () => {
    const environment =
      readyEnvironment();

    delete environment
      .FACEBOOK_GRAPH_VERSION;

    const report =
      buildSocialAuthReadinessReport({
        environment,
      });

    const facebook =
      report.providers.find(
        (provider) =>
          provider.provider ===
          "facebook"
      );

    assert.equal(
      facebook.ready,
      false
    );
    assert.equal(
      facebook.checks
        .facebookGraphVersionConfigured,
      false
    );
  }
);

test(
  "readiness report never exposes OAuth client IDs or secrets",
  () => {
    const environment =
      readyEnvironment();

    const serialised =
      JSON.stringify(
        buildSocialAuthReadinessReport({
          environment,
        })
      );

    for (const secret of [
      "google-client-id",
      "google-secret-value",
      "facebook-client-id",
      "facebook-secret-value",
      "microsoft-client-id",
      "microsoft-secret-value",
      "yahoo-client-id",
      "yahoo-secret-value",
    ]) {
      assert.equal(
        serialised.includes(
          secret
        ),
        false,
        secret
      );
    }
  }
);

test(
  "readiness audit explicitly remains read-only and performs no provider request",
  () => {
    const report =
      buildSocialAuthReadinessReport({
        environment:
          readyEnvironment(),
      });

    assert.equal(
      report.readOnly,
      true
    );
    assert.equal(
      report.providerRequestsPerformed,
      false
    );
    assert.equal(
      report.databaseWritesRequested,
      false
    );
  }
);


test(
  "system administration exposes only the sanitized social-auth readiness report behind feature-control read access",
  async () => {
    const controller =
      await readFile(
        new URL(
          "../controllers/systemAdministrationController.js",
          import.meta.url
        ),
        "utf8"
      );
    const routes =
      await readFile(
        new URL(
          "../routes/systemAdministrationRoutes.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      controller,
      /buildSocialAuthReadinessReport/
    );
    assert.match(
      controller,
      /socialAuth:\s*report/
    );
    assert.match(
      routes,
      /"\/social-auth-readiness"/
    );
    assert.match(
      routes,
      /"feature-control:read"/
    );
    assert.doesNotMatch(
      controller,
      /CLIENT_SECRET/
    );
  }
);
