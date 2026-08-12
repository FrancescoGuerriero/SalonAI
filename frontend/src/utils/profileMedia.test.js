import assert from "node:assert/strict";
import test from "node:test";

import {
  isProfileImageValue,
  isSupportedProfileFile,
  profileInitials,
} from "./profileMedia.js";

test("profileInitials creates a compact fallback avatar", () => {
  assert.equal(profileInitials("Maya Thompson"), "MT");
  assert.equal(profileInitials("Luca"), "L");
  assert.equal(profileInitials(""), "SA");
});

test("profile image values accept HTTPS and supported image data URLs", () => {
  assert.equal(
    isProfileImageValue("https://example.com/photo.jpg"),
    true
  );
  assert.equal(
    isProfileImageValue("data:image/webp;base64,AAAA"),
    true
  );
  assert.equal(
    isProfileImageValue("javascript:alert(1)"),
    false
  );
});

test("profile file validation enforces supported types and the source size limit", () => {
  assert.equal(
    isSupportedProfileFile({
      type: "image/jpeg",
      size: 1024,
    }),
    true
  );
  assert.equal(
    isSupportedProfileFile({
      type: "image/svg+xml",
      size: 1024,
    }),
    false
  );
});
