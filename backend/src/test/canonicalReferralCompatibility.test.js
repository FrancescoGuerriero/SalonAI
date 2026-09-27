import assert from "node:assert/strict";
import test from "node:test";

import CanonicalReferral from "../features/premium/referrals/Referral.js";
import LegacyReferral from "../features/referrals/Referral.js";
import CapacityReferral from "../features/capacityPlanning/referrals/Referral.js";

import * as canonicalReferralController from "../features/premium/referrals/referralController.js";
import * as legacyReferralController from "../features/referrals/referralController.js";
import * as capacityReferralController from "../features/capacityPlanning/referrals/referralController.js";

const CONTROLLER_EXPORTS = [
  "createReferral",
  "getMyReferrals",
  "listReferrals",
  "qualifyReferral",
];

function assertSameControllerExports(compatibility) {
  for (const name of CONTROLLER_EXPORTS) {
    assert.strictEqual(
      compatibility[name],
      canonicalReferralController[name],
      `${name} must delegate to the canonical premium referral implementation`
    );
  }
}

test(
  "legacy Referral models resolve to canonical premium authority",
  () => {
    assert.strictEqual(
      LegacyReferral,
      CanonicalReferral
    );
    assert.strictEqual(
      CapacityReferral,
      CanonicalReferral
    );
  }
);

test(
  "legacy Referral controllers resolve to canonical premium authority",
  () => {
    assertSameControllerExports(
      legacyReferralController
    );
    assertSameControllerExports(
      capacityReferralController
    );
  }
);
