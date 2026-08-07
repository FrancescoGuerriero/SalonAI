import assert from "node:assert/strict";
import test from "node:test";

import { normaliseAccountUpdate } from "../controllers/authController.js";
import CustomerExperienceProfile from "../features/customerExperience/CustomerExperienceProfile.js";
import SalonOffer from "../features/customerExperience/SalonOffer.js";
import {
  normaliseDiscovery,
  normaliseOffer,
  safeHttpsUrl,
} from "../features/customerExperience/customerExperienceService.js";
import { calculateOfferDiscount } from "../features/commerce/commerceService.js";

test("account updates retain only supported personal and home-address fields", () => {
  const result = normaliseAccountUpdate({
    name: "  Francesco   Guerriero ",
    phone: "  07123 456789 ",
    role: "admin",
    homeAddress: {
      line1: "  10   High Street ",
      city: " London ",
      postcode: " e1 1aa ",
      country: " United Kingdom ",
      isVerified: true,
    },
  });

  assert.deepEqual(result, {
    name: "Francesco Guerriero",
    phone: "07123 456789",
    homeAddress: {
      line1: "10 High Street",
      line2: "",
      city: "London",
      county: "",
      postcode: "E1 1AA",
      country: "United Kingdom",
    },
  });
  assert.equal("role" in result, false);
  assert.equal("isVerified" in result.homeAddress, false);
});

test("discovery preferences are normalised, deduplicated and bounded", () => {
  const result = normaliseDiscovery({
    postcode: " ig11 0fa ",
    travelRadiusMiles: 15,
    serviceCategories: ["Colour", "Colour", "Cut"],
    preferredDays: ["Monday", "monday", "Funday"],
    preferredTimeOfDay: "AFTERNOON",
  });

  assert.equal(result.postcode, "IG11 0FA");
  assert.deepEqual(result.serviceCategories, ["Colour", "Cut"]);
  assert.deepEqual(result.preferredDays, ["monday"]);
  assert.equal(result.preferredTimeOfDay, "afternoon");
});

test("inspiration links require HTTPS", () => {
  assert.equal(safeHttpsUrl(""), "");
  assert.equal(safeHttpsUrl("https://example.com/style.jpg"), "https://example.com/style.jpg");
  assert.throws(() => safeHttpsUrl("http://example.com/style.jpg"), /HTTPS URL/);
});

test("offer validation rejects invalid values and expired dates", () => {
  assert.throws(() => normaliseOffer({ discountType: "percentage", value: 101, endsAt: "2099-01-01" }), /invalid/);
  assert.throws(() => normaliseOffer({ discountType: "fixed", value: 10, endsAt: "2020-01-01" }), /future/);
  const offer = normaliseOffer({
    code: " summer10 ",
    title: "Summer care",
    description: "Ten pounds off",
    discountType: "fixed",
    value: 10,
    endsAt: "2099-01-01",
  });
  assert.equal(offer.code, "SUMMER10");
  assert.equal(offer.value, 10);
});

test("customer experience schemas expose the developed feature records", () => {
  const paths = CustomerExperienceProfile.schema.paths;
  for (const name of ["reviews", "favourites", "claimedOffers", "walletCards", "appointmentRequests", "consultations", "inspirationItems", "feedback"]) {
    assert.ok(paths[name], `${name} should exist in the customer experience schema`);
  }
  assert.ok(paths["consents.analytics"]);
  assert.ok(paths["discovery.postcode"]);
  assert.ok(SalonOffer.schema.paths.code);
  assert.ok(SalonOffer.schema.indexes().some(([fields]) => fields.active === 1));
});

test("claimed offers calculate bounded checkout discounts", () => {
  assert.equal(calculateOfferDiscount({ discountType: "percentage", value: 10 }, 120), 12);
  assert.equal(calculateOfferDiscount({ discountType: "fixed", value: 15 }, 120), 15);
  assert.equal(calculateOfferDiscount({ discountType: "fixed", value: 200 }, 120), 120);
  assert.equal(calculateOfferDiscount(null, 120), 0);
});
