import assert from "node:assert/strict";
import test from "node:test";

import * as canonicalPremiumUtils from "../features/premium/premiumUtils.js";
import * as compatibilityPremiumUtils from "../features/premiumUtils.js";

for (const name of [
  "createCode",
  "hashValue",
  "domainError",
]) {
  test(
    `premium utility compatibility delegates ${name} to canonical authority`,
    () => {
      assert.strictEqual(
        compatibilityPremiumUtils[name],
        canonicalPremiumUtils[name]
      );
    }
  );
}
