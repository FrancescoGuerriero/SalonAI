import assert from "node:assert/strict";
import test from "node:test";

import CanonicalPushSubscription from "../features/premium/push/PushSubscription.js";
import LegacyPushSubscription from "../features/push/PushSubscription.js";
import CapacityPushSubscription from "../features/capacityPlanning/push/PushSubscription.js";

import * as canonicalPushController from "../features/premium/push/pushController.js";
import * as legacyPushController from "../features/push/pushController.js";
import * as capacityPushController from "../features/capacityPlanning/push/pushController.js";

const COMPATIBILITY_EXPORTS = [
  "saveSubscription",
  "disableSubscription",
];

function assertSameControllerExports(controller) {
  for (const name of COMPATIBILITY_EXPORTS) {
    assert.strictEqual(
      controller[name],
      canonicalPushController[name],
      `${name} must delegate to the canonical premium push implementation`
    );
  }
}

test(
  "legacy PushSubscription models resolve to canonical premium authority",
  () => {
    assert.strictEqual(
      LegacyPushSubscription,
      CanonicalPushSubscription
    );
    assert.strictEqual(
      CapacityPushSubscription,
      CanonicalPushSubscription
    );
  }
);

test(
  "legacy push controllers preserve compatibility while using premium authority",
  () => {
    assertSameControllerExports(
      legacyPushController
    );
    assertSameControllerExports(
      capacityPushController
    );

    assert.equal(
      "listSubscriptions" in legacyPushController,
      false,
      "legacy compatibility surface must not silently expose premium management listing"
    );
    assert.equal(
      "listSubscriptions" in capacityPushController,
      false,
      "capacity compatibility surface must not silently expose premium management listing"
    );
  }
);
