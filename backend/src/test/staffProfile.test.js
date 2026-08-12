import assert from "node:assert/strict";
import test from "node:test";

import {
  normaliseStaffProfileUpdate,
} from "../controllers/stylistController.js";

test("staff profile updates keep only public-facing fields", () => {
  const result = normaliseStaffProfileUpdate({
    jobTitle: "  Senior Colourist  ",
    biography: "  Colour, care and confidence.  ",
    yearsExperience: 12.4,
    specialties: ["Balayage", "Colour", "Balayage"],
    languages: "English, Italian",
    instagram: "@salonai.colour",
    website: "https://example.com/profile",
    profilePublished: true,
    email: "should-not-be-copied@example.com",
    phone: "000000",
  });

  assert.equal(result.jobTitle, "Senior Colourist");
  assert.equal(result.biography, "Colour, care and confidence.");
  assert.equal(result.yearsExperience, 12);
  assert.deepEqual(result.specialties, ["Balayage", "Colour"]);
  assert.deepEqual(result.languages, ["English", "Italian"]);
  assert.equal(result.instagram, "@salonai.colour");
  assert.equal(result.website, "https://example.com/profile");
  assert.equal(result.profilePublished, true);
  assert.equal("email" in result, false);
  assert.equal("phone" in result, false);
});

test("staff profile publication can be disabled", () => {
  const result = normaliseStaffProfileUpdate({
    profilePublished: false,
  });

  assert.equal(result.profilePublished, false);
});
