import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import { isEmailAddress } from "../shared/inputValidation.js";

test("email validation accepts ordinary customer addresses", () => {
  assert.equal(isEmailAddress("francesco@example.co.uk"), true);
  assert.equal(isEmailAddress("salon.team+bookings@example.com"), true);
});

test("email validation rejects malformed and oversized addresses", () => {
  assert.equal(isEmailAddress("missing-at.example.com"), false);
  assert.equal(isEmailAddress("two@@example.com"), false);
  assert.equal(isEmailAddress("spaces are@example.com"), false);
  assert.equal(isEmailAddress("person@example..com"), false);
  assert.equal(isEmailAddress(`${"a".repeat(250)}@example.com`), false);
});

test("validated request identifiers can be converted to MongoDB ObjectIds", () => {
  const value = "507f1f77bcf86cd799439011";

  assert.equal(mongoose.isValidObjectId(value), true);
  assert.ok(new mongoose.Types.ObjectId(value) instanceof mongoose.Types.ObjectId);
});
