import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test(
  "email registration establishes a session immediately when verification is not required",
  async () => {
    const controller =
      await source(
        "../controllers/emailVerificationController.js"
      );

    assert.match(
      controller,
      /establishCustomerSession/
    );
    assert.match(
      controller,
      /createAccessToken/
    );
    assert.match(
      controller,
      /createRefreshToken/
    );
    assert.match(
      controller,
      /setRefreshCookie/
    );
    assert.match(
      controller,
      /verificationRequired:\s*false[\s\S]*authenticated:\s*true[\s\S]*token/
    );
  }
);

test(
  "email verification signs an active customer in but does not authenticate a disabled account",
  async () => {
    const controller =
      await source(
        "../controllers/emailVerificationController.js"
      );

    assert.match(
      controller,
      /emailVerified\s*=\s*true/
    );
    assert.match(
      controller,
      /user\.isActive\s*===\s*false/
    );
    assert.match(
      controller,
      /authenticated:\s*false/
    );
    assert.match(
      controller,
      /Your email has been verified\. You are signed in and ready to continue\./
    );
  }
);

test(
  "frontend registration stores server-issued sessions and removes password confirmation friction",
  async () => {
    const service =
      await source(
        "../../../frontend/src/Services/authService.js"
      );
    const context =
      await source(
        "../../../frontend/src/context/AuthContext.jsx"
      );
    const register =
      await source(
        "../../../frontend/src/pages/Register.jsx"
      );

    assert.match(
      service,
      /storeSessionFromResponse/
    );
    assert.match(
      context,
      /const verifyEmail =/
    );
    assert.match(
      context,
      /response\?\.token/
    );
    assert.match(
      register,
      /Create account and continue/
    );
    assert.match(
      register,
      /Check your email/
    );
    assert.doesNotMatch(
      register,
      /registerConfirmPassword/
    );
    assert.doesNotMatch(
      register,
      /confirmPassword/
    );
  }
);
