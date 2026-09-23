import assert from "node:assert/strict";
import test from "node:test";

import TrackingConsentReceipt from "../models/TrackingConsentReceipt.js";

test("tracking consent receipt stores only minimal category evidence", () => {
  const receipt =
    new TrackingConsentReceipt({
      receiptId:
        "consent_test_receipt_12345",
      version:
        "2026-09-23",
      necessary:
        true,
      choices: {
        analytics:
          false,
        advertising:
          true,
        experience:
          false,
      },
      source:
        "consent_banner",
      consentUpdatedAt:
        new Date(
          "2026-09-23T12:00:00.000Z"
        ),
    });

  const error =
    receipt.validateSync();

  assert.equal(
    error,
    undefined
  );
  assert.equal(
    receipt.choices
      .analytics,
    false
  );
  assert.equal(
    receipt.choices
      .advertising,
    true
  );
  assert.equal(
    receipt.choices
      .experience,
    false
  );

  const raw =
    receipt.toObject();

  assert.equal(
    Object.hasOwn(
      raw,
      "email"
    ),
    false
  );
  assert.equal(
    Object.hasOwn(
      raw,
      "ipAddress"
    ),
    false
  );
  assert.equal(
    Object.hasOwn(
      raw,
      "userAgent"
    ),
    false
  );
});

test("tracking consent receipt rejects invalid identifiers", () => {
  const receipt =
    new TrackingConsentReceipt({
      receiptId:
        "short",
      version:
        "2026-09-23",
      choices: {
        analytics:
          false,
        advertising:
          false,
        experience:
          false,
      },
      consentUpdatedAt:
        new Date(),
    });

  const error =
    receipt.validateSync();

  assert.ok(error);
  assert.ok(
    error.errors
      .receiptId
  );
});
