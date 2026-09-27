import assert from "node:assert/strict";
import test from "node:test";

import CanonicalNotification from "../features/premium/notifications/Notification.js";
import LegacyNotification from "../features/notifications/Notification.js";
import CapacityNotification from "../features/capacityPlanning/notifications/Notification.js";

import * as canonicalNotificationController from "../features/premium/notifications/notificationController.js";
import * as legacyNotificationController from "../features/notifications/notificationController.js";
import * as capacityNotificationController from "../features/capacityPlanning/notifications/notificationController.js";

const CONTROLLER_EXPORTS = [
  "listNotifications",
  "queueNotification",
];

function assertSameControllerExports(compatibility) {
  for (const name of CONTROLLER_EXPORTS) {
    assert.strictEqual(
      compatibility[name],
      canonicalNotificationController[name],
      `${name} must delegate to the canonical premium notification implementation`
    );
  }
}

test(
  "legacy Notification models resolve to canonical premium authority",
  () => {
    assert.strictEqual(
      LegacyNotification,
      CanonicalNotification
    );
    assert.strictEqual(
      CapacityNotification,
      CanonicalNotification
    );

    assert.ok(
      CanonicalNotification.schema.path("readAt"),
      "canonical Notification schema must retain premium readAt capability"
    );
  }
);

test(
  "legacy Notification controllers resolve to canonical premium authority",
  () => {
    assertSameControllerExports(
      legacyNotificationController
    );
    assertSameControllerExports(
      capacityNotificationController
    );
  }
);
