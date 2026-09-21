import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normaliseManagedStylistUpdate,
} from "../controllers/stylistController.js";

test("managed stylist updates allow only supported profile and operational fields", () => {
  const update =
    normaliseManagedStylistUpdate({
      jobTitle:
        "Senior stylist",
      biography:
        "Colour specialist",
      profileImage:
        "https://example.com/staff.jpg",
      profilePublished:
        true,
      acceptsAppointments:
        true,
      isActive:
        true,
      userAccount:
        "507f1f77bcf86cd799439011",
      rating: 1,
      reviews: 9999,
      services: [
        "507f1f77bcf86cd799439012",
      ],
      workingHours: [],
    });

  assert.deepEqual(
    Object.keys(
      update
    ).sort(),
    [
      "acceptsAppointments",
      "biography",
      "isActive",
      "jobTitle",
      "profileImage",
      "profilePublished",
    ].sort()
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      update,
      "userAccount"
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      update,
      "rating"
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      update,
      "reviews"
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      update,
      "services"
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      update,
      "workingHours"
    ),
    false
  );
});

test("managed stylist operational switches require booleans", () => {
  for (const field of [
    "isActive",
    "acceptsAppointments",
  ]) {
    assert.throws(
      () =>
        normaliseManagedStylistUpdate({
          [field]:
            "true",
        }),
      (error) =>
        error.statusCode ===
        400
    );
  }
});

test("managed stylist updates reject an unsupported-only payload", () => {
  assert.throws(
    () =>
      normaliseManagedStylistUpdate({
        userAccount:
          "507f1f77bcf86cd799439011",
      }),
    (error) =>
      error.statusCode ===
      400
  );
});

test("photo synchronisation uses the persisted employee link rather than request data", async () => {
  const controller =
    await readFile(
      new URL(
        "../controllers/stylistController.js",
        import.meta.url
      ),
      "utf8"
    );

  const start =
    controller.indexOf(
      "export async function updateStylist"
    );
  const source =
    controller.slice(
      start,
      controller.indexOf(
        "export async function deleteStylist",
        start
      )
    );

  assert.match(
    source,
    /normaliseManagedStylistUpdate/
  );
  assert.match(
    source,
    /Stylist\.findById\(/
  );
  assert.match(
    source,
    /select\([\s\S]*?_id userAccount/
  );
  assert.match(
    source,
    /existingStylist\.userAccount/
  );
  assert.match(
    source,
    /User\.findByIdAndUpdate/
  );
  assert.doesNotMatch(
    source,
    /\.\.\.req\.body/
  );
});
