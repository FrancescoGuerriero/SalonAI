import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test(
  "request-sensitive permission checks use effective-authority-aware helper",
  async () => {
    const commerce = await source(
      "../features/commerce/commerceController.js"
    );
    const groups = await source(
      "../features/groupBookings/groupBookingRoutes.js"
    );
    const auth = await source(
      "../routes/authRoutes.js"
    );

    for (const text of [
      commerce,
      groups,
      auth,
    ]) {
      assert.match(
        text,
        /hasRequestPermission/
      );
      assert.doesNotMatch(
        text,
        /hasUserPermission/
      );
    }

    assert.match(
      commerce,
      /hasRequestPermission\(\s*req,\s*"product:inventory:update"\s*\)/
    );

    assert.match(
      groups,
      /hasRequestPermission\(request,\s*permission\)/
    );

    assert.match(
      auth,
      /hasRequestPermission\(\s*req,\s*permission\s*\)/
    );
  }
);
