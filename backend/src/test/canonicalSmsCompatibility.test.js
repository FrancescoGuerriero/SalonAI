import assert from "node:assert/strict";
import test from "node:test";

import CanonicalSmsRule from "../features/premium/sms/SmsRule.js";
import LegacySmsRule from "../features/sms/SmsRule.js";
import CapacitySmsRule from "../features/capacityPlanning/sms/SmsRule.js";

import * as canonicalSmsController from "../features/premium/sms/smController.js";
import * as legacySmsController from "../features/sms/smController.js";
import * as capacitySmsController from "../features/capacityPlanning/sms/smController.js";

const CONTROLLER_EXPORTS = [
  "listSmsRules",
  "createSmsRule",
];

function assertSameControllerExports(controller) {
  for (const name of CONTROLLER_EXPORTS) {
    assert.strictEqual(
      controller[name],
      canonicalSmsController[name],
      `${name} must delegate to the canonical premium SMS implementation`
    );
  }
}

test(
  "legacy SmsRule models resolve to canonical premium authority",
  () => {
    assert.strictEqual(
      LegacySmsRule,
      CanonicalSmsRule
    );
    assert.strictEqual(
      CapacitySmsRule,
      CanonicalSmsRule
    );
  }
);

test(
  "legacy SMS controllers resolve to canonical premium authority",
  () => {
    assertSameControllerExports(
      legacySmsController
    );
    assertSameControllerExports(
      capacitySmsController
    );
  }
);
