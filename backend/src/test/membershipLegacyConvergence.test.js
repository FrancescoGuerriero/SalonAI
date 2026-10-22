import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("historical rebooking service path delegates to canonical campaign logic", async () => {
  const compatibility = await source("../routes/rebookingCampaignService.js");
  assert.match(
    compatibility,
    /features\/rebookingCampaigns\/rebookingCampaignService\.js/
  );
  assert.doesNotMatch(compatibility, /Membership/);
});

test("canonical membership workspace has no capacity-planning Membership dependency", async () => {
  const membership = await source("../features/memberships/membershipService.js");
  const benefits = await source("../features/memberships/membershipBenefitService.js");
  const combined = `${membership}\n${benefits}`;
  assert.doesNotMatch(combined, /capacityPlanning\/loyalty\/Membership/);
  assert.match(combined, /MembershipContract/);
});
