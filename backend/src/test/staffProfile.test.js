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


test("staff self-profile partial updates change only supplied safe fields", () => {
  const result =
    normaliseStaffProfileUpdate(
      {
        biography:
          "  Updated biography only.  ",
        profilePublished:
          true,
      },
      {
        partial: true,
        allowPublication:
          false,
      }
    );

  assert.deepEqual(
    result,
    {
      biography:
        "Updated biography only.",
    }
  );
});

test("self-profile controller excludes publication from own updates", async () => {
  const { readFile } =
    await import(
      "node:fs/promises"
    );

  const controller =
    await readFile(
      new URL(
        "../controllers/staffSelfProfileController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    controller,
    /partial:\s*true/
  );
  assert.match(
    controller,
    /allowPublication:\s*false/
  );
  assert.match(
    controller,
    /"super_admin"/
  );
});

test("staff self-service UI does not expose profile publication control", async () => {
  const { readFile } =
    await import(
      "node:fs/promises"
    );

  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/StaffProfileEditorPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /includePublication\s*=\s*false/
  );

  assert.match(
    page,
    /\{canReadAll \? \(\s*<section className="staff-profile-publish">/
  );
});
