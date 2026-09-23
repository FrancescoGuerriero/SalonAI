import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import User from "../models/user.js";
import {
  SOCIAL_AUTH_PROVIDERS,
} from "../models/SocialIdentity.js";
import {
  createSocialAuthorization,
  readSocialState,
  socialAuthTransactionCookie,
  socialProviderAvailability,
  verifySocialStateBrowserBinding,
} from "../features/socialAuth/socialAuthProvider.js";

test("social authentication supports the four customer providers", () => {
  assert.deepEqual(
    [...SOCIAL_AUTH_PROVIDERS].sort(),
    [
      "facebook",
      "google",
      "microsoft",
      "yahoo",
    ]
  );

  assert.deepEqual(
    socialProviderAvailability()
      .map(
        (item) =>
          item.provider
      )
      .sort(),
    [
      "facebook",
      "google",
      "microsoft",
      "yahoo",
    ]
  );
});



test("social authorization state is bound to the initiating browser transaction", () => {
  const keys = [
    "SOCIAL_GOOGLE_CLIENT_ID",
    "SOCIAL_GOOGLE_CLIENT_SECRET",
    "SOCIAL_GOOGLE_REDIRECT_URI",
  ];
  const previous =
    Object.fromEntries(
      keys.map((key) => [
        key,
        process.env[key],
      ])
    );

  process.env.SOCIAL_GOOGLE_CLIENT_ID =
    "stage1d-client";
  process.env.SOCIAL_GOOGLE_CLIENT_SECRET =
    "stage1d-secret";
  process.env.SOCIAL_GOOGLE_REDIRECT_URI =
    "http://localhost:5000/api/auth/social/google/callback";

  try {
    const authorization =
      createSocialAuthorization({
        provider: "google",
        returnTo: "/account",
      });
    const url =
      new URL(
        authorization.authorizationUrl
      );
    const state =
      readSocialState(
        url.searchParams.get(
          "state"
        )
      );
    const cookie =
      socialAuthTransactionCookie(
        "google"
      );

    assert.equal(
      authorization.provider,
      "google"
    );
    assert.equal(
      state.provider,
      "google"
    );
    assert.equal(
      state.returnTo,
      "/account"
    );
    assert.ok(
      state.browserBindingHash
    );
    assert.ok(
      authorization.transaction
        .value
    );
    assert.equal(
      authorization.transaction
        .name,
      cookie.name
    );
    assert.deepEqual(
      authorization.transaction
        .options,
      cookie.options
    );
    assert.equal(
      cookie.options.httpOnly,
      true
    );
    assert.equal(
      cookie.options.sameSite,
      "lax"
    );
    assert.equal(
      cookie.options.maxAge,
      10 * 60 * 1000
    );
    assert.equal(
      cookie.options.path,
      "/api/auth/social/google/callback"
    );

    assert.equal(
      verifySocialStateBrowserBinding(
        state,
        authorization.transaction
          .value
      ),
      true
    );

    assert.throws(
      () =>
        verifySocialStateBrowserBinding(
          state,
          "different-browser-binding"
        ),
      (error) =>
        error?.code ===
          "SOCIAL_AUTH_BROWSER_BINDING_FAILED" &&
        error?.statusCode === 400
    );

    assert.throws(
      () =>
        verifySocialStateBrowserBinding(
          state,
          ""
        ),
      (error) =>
        error?.code ===
        "SOCIAL_AUTH_BROWSER_BINDING_FAILED"
    );
  } finally {
    for (const key of keys) {
      if (
        previous[key] ===
        undefined
      ) {
        delete process.env[key];
      } else {
        process.env[key] =
          previous[key];
      }
    }
  }
});

test("social auth controller keeps the browser transaction secret out of JSON and consumes it on callback", async () => {
  const source =
    await readFile(
      new URL(
        "../features/socialAuth/socialAuthController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /const\s*\{\s*transaction,\s*\.\.\.result\s*\}\s*=\s*createSocialAuthorization/
  );
  assert.match(
    source,
    /response\.cookie\(\s*transaction\.name,\s*transaction\.value,\s*transaction\.options/
  );
  assert.match(
    source,
    /verifySocialStateBrowserBinding\(/
  );
  assert.match(
    source,
    /response\.clearCookie\(\s*transaction\.name,\s*clearCookieOptions/
  );
  assert.match(
    source,
    /authorizationUrl:\s*result\.authorizationUrl/
  );
  assert.equal(
    (
      source.match(
        /authorizationUrl:\s*result\.authorizationUrl/g
      ) || []
    ).length,
    2
  );
});

test("provider-only customer accounts do not require a local password", () => {
  const socialUser =
    new User({
      name: "Social Customer",
      email:
        "social@example.com",
      role: "customer",
      passwordAuthEnabled:
        false,
    });

  assert.equal(
    socialUser.validateSync()
      ?.errors?.password,
    undefined
  );

  const passwordUser =
    new User({
      name: "Password Customer",
      email:
        "password@example.com",
      role: "customer",
    });

  assert.ok(
    passwordUser.validateSync()
      ?.errors?.password
  );
});

test("social sign-in requests identity scopes rather than calendar access", async () => {
  const source =
    await readFile(
      new URL(
        "../features/socialAuth/socialAuthProvider.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /"openid"/
  );
  assert.match(
    source,
    /"email"/
  );
  assert.match(
    source,
    /"public_profile"/
  );

  assert.equal(
    source.includes(
      "calendar.events"
    ),
    false
  );
  assert.equal(
    source.includes(
      "Calendars.ReadWrite"
    ),
    false
  );
  assert.equal(
    source.includes(
      "mail-r"
    ),
    false
  );
});

test("customer login and registration expose all provider choices", async () => {
  const source =
    await readFile(
      new URL(
        "../../../frontend/src/components/auth/SocialSignInOptions.jsx",
        import.meta.url
      ),
      "utf8"
    );

  for (const label of [
    "Google",
    "Facebook",
    "Microsoft",
    "Yahoo",
  ]) {
    assert.match(
      source,
      new RegExp(label)
    );
  }

  const login =
    await readFile(
      new URL(
        "../../../frontend/src/pages/Login.jsx",
        import.meta.url
      ),
      "utf8"
    );
  const register =
    await readFile(
      new URL(
        "../../../frontend/src/pages/Register.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    login,
    /SocialSignInOptions/
  );
  assert.match(
    register,
    /SocialSignInOptions/
  );
  assert.match(
    login,
    /user\?\.role === "customer"[\s\S]*?"\/account"/
  );
});

test("account settings expose explicit provider linking with lockout protection", async () => {
  const service =
    await readFile(
      new URL(
        "../features/socialAuth/socialAuthService.js",
        import.meta.url
      ),
      "utf8"
    );

  const settings =
    await readFile(
      new URL(
        "../../../frontend/src/components/auth/SocialAccountLinks.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    service,
    /LAST_SIGN_IN_METHOD/
  );
  assert.match(
    service,
    /passwordAuthEnabled/
  );
  assert.match(
    settings,
    /Connected sign-in accounts/
  );
  assert.match(
    settings,
    /Google/
  );
  assert.match(
    settings,
    /Facebook/
  );
  assert.match(
    settings,
    /Microsoft/
  );
  assert.match(
    settings,
    /Yahoo/
  );
  assert.match(
    settings,
    /Unlink/
  );
});
