import assert from "node:assert/strict";
import test from "node:test";

import {
  getStylistName,
  getStylistSpecialtyLabel,
  isStylistActive,
  stylistOffersService,
} from "./stylists.js";

test("getStylistName maps the production API name fields", () => {
  assert.equal(
    getStylistName({ firstName: "Francesco", lastName: "Picardi" }),
    "Francesco Picardi"
  );
});

test("getStylistSpecialtyLabel maps an API specialties array", () => {
  assert.equal(
    getStylistSpecialtyLabel({ specialties: ["Colour", "Cutting"] }),
    "Colour · Cutting"
  );
});

test("isStylistActive honours both supported active fields", () => {
  assert.equal(isStylistActive({ isActive: false }), false);
  assert.equal(isStylistActive({ active: false }), false);
  assert.equal(isStylistActive({ isActive: true }), true);
});

test("stylistOffersService matches populated and identifier-only services", () => {
  assert.equal(
    stylistOffersService(
      { services: [{ _id: "service-a" }, "service-b"] },
      "service-b"
    ),
    true
  );

  assert.equal(
    stylistOffersService(
      { services: [{ _id: "service-a" }] },
      "service-b"
    ),
    false
  );
});
