import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import User from "../models/user.js";
import {
  SOCIAL_AUTH_PROVIDERS,
} from "../models/SocialIdentity.js";
import {
  socialProviderAvailability,
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
