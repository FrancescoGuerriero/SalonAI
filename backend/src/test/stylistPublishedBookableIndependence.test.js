import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  appointmentEligibleStylistFilter,
  customerVisibleStylistFilter,
  isAppointmentEligibleStylist,
  isCustomerVisibleStylist,
} from "../services/stylistBookingEligibilityService.js";

test("Published and Bookable remain independent employee states", () => {
  const publishedNotBookable = {
    isActive: true,
    profilePublished: true,
    acceptsAppointments: false,
  };

  assert.equal(
    isCustomerVisibleStylist(
      publishedNotBookable
    ),
    true
  );
  assert.equal(
    isAppointmentEligibleStylist(
      publishedNotBookable
    ),
    false
  );

  const bookableNotPublished = {
    isActive: true,
    profilePublished: false,
    acceptsAppointments: true,
  };

  assert.equal(
    isCustomerVisibleStylist(
      bookableNotPublished
    ),
    false
  );
  assert.equal(
    isAppointmentEligibleStylist(
      bookableNotPublished
    ),
    true
  );
});

test("database filters keep public-team and booking semantics separate", () => {
  assert.deepEqual(
    customerVisibleStylistFilter(),
    {
      isActive: true,
      profilePublished: true,
    }
  );

  assert.deepEqual(
    appointmentEligibleStylistFilter(),
    {
      isActive: true,
      acceptsAppointments: true,
    }
  );
});

test("stylist controller uses separate public-team and booking handlers", async () => {
  const controller =
    await readFile(
      new URL(
        "../controllers/stylistController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    controller,
    /export async function getBookingStylists/
  );
  assert.match(
    controller,
    /appointmentEligibleStylistFilter\(\)/
  );
  assert.match(
    controller,
    /req\.query\?\.service/
  );
  assert.match(
    controller,
    /filter\.services\s*=/
  );
  assert.match(
    controller,
    /BOOKING_STYLIST_CARD_FIELDS/
  );
  assert.match(
    controller,
    /customerVisibleStylistFilter\(\)/
  );
  assert.match(
    controller,
    /!isAppointmentEligibleStylist\(\s*stylist\s*\)/
  );
  assert.doesNotMatch(
    controller,
    /export const getBookingStylists = getPublicStylists/
  );
});

test("dual-purpose stylist page chooses endpoint and feature by mode", async () => {
  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/Stylists.jsx",
        import.meta.url
      ),
      "utf8"
    );

  const app =
    await readFile(
      new URL(
        "../../../frontend/src/App.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /getBookingStylists\(\s*selectedService\s*\._id/
  );
  assert.match(
    page,
    /getPublicTeam\(\)/
  );
  assert.match(
    page,
    /"public-team"/
  );
  assert.match(
    page,
    /"online-booking"/
  );

  assert.match(
    app,
    /path="stylists"[\s\S]*element=\{<Stylists \/>\}/
  );
  assert.doesNotMatch(
    app,
    /path="stylists"[\s\S]{0,180}featurePage/
  );
});

test("public team catalogue avoids service population on the normal stylist page", async () => {
  const controller =
    await readFile(
      new URL(
        "../controllers/stylistController.js",
        import.meta.url
      ),
      "utf8"
    );

  const publicFields =
    controller.match(
      /export const PUBLIC_STYLIST_FIELDS = \[[\s\S]*?\]\.join\(" "\);/
    )?.[0] || "";

  assert.doesNotMatch(
    publicFields,
    /"services"/
  );

  const publicHandler =
    controller.match(
      /export async function getPublicStylists[\s\S]*?export async function getBookingStylists/
    )?.[0] || "";

  assert.doesNotMatch(
    publicHandler,
    /\.populate\(/
  );
});
