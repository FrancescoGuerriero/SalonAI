import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResetUrl,
  hashResetToken,
  normaliseResetEmail,
  validateNewPassword,
} from "../controllers/passwordResetController.js";

test("password reset tokens are stored as deterministic SHA-256 hashes", () => {
  const hash = hashResetToken("example-token");

  assert.equal(hash.length, 64);
  assert.equal(hash, hashResetToken("example-token"));
  assert.notEqual(hash, "example-token");
});

test("password reset email addresses are normalised", () => {
  assert.equal(
    normaliseResetEmail("  Customer@Example.COM  "),
    "customer@example.com"
  );
});

test("password reset requires at least eight characters", () => {
  assert.throws(
    () => validateNewPassword("short"),
    /at least 8 characters/i
  );

  assert.equal(validateNewPassword("long-enough"), "long-enough");
});

test("password reset URL points to the login reset flow", () => {
  const url = buildResetUrl("abc 123");

  assert.match(url, /\/login\?resetToken=/);
  assert.match(url, /abc%20123/);
});
