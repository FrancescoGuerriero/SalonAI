import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedProfileImage,
  normaliseProfileImage,
  normalisePublicProfileUrl,
} from "../utils/profileMedia.js";

test("profile images accept HTTPS URLs", () => {
  assert.equal(
    normaliseProfileImage("https://example.com/profile.jpg"),
    "https://example.com/profile.jpg"
  );
});

test("profile images reject insecure HTTP URLs", () => {
  assert.throws(
    () => normaliseProfileImage("http://example.com/profile.jpg"),
    /HTTPS/
  );
});

test("profile images accept small JPEG data URLs", () => {
  const payload = Buffer.from("profile-photo").toString("base64");
  const value = `data:image/jpeg;base64,${payload}`;

  assert.equal(normaliseProfileImage(value), value);
  assert.equal(isSupportedProfileImage(value), true);
});

test("profile images reject unsupported SVG data URLs", () => {
  const payload = Buffer.from("<svg></svg>").toString("base64");

  assert.throws(
    () => normaliseProfileImage(`data:image/svg+xml;base64,${payload}`),
    /JPEG, PNG or WebP/
  );
});

test("public profile links require HTTPS", () => {
  assert.equal(
    normalisePublicProfileUrl("https://example.com/stylist"),
    "https://example.com/stylist"
  );

  assert.throws(
    () => normalisePublicProfileUrl("http://example.com/stylist"),
    /HTTPS/
  );
});

test("instagram-style handles can be retained when explicitly allowed", () => {
  assert.equal(
    normalisePublicProfileUrl("@salonai.stylist", { allowHandle: true }),
    "@salonai.stylist"
  );
});
