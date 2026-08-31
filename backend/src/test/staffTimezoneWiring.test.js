import assert
  from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import test
  from "node:test";

const STAFF_SERVICE_URL =
  new URL(
    "../features/staff/staffService.js",
    import.meta.url
  );

test(
  "staff scheduling uses salon timezone helpers instead of process-local Date fields",
  async () => {
    const source =
      await readFile(
        STAFF_SERVICE_URL,
        "utf8"
      );

    for (
      const helper of [
        "salonDateAnchor",
        "salonDayBounds",
        "salonDayOfWeek",
        "salonMinutesSinceMidnight",
        "sameSalonDay",
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          `\\b${helper}\\b`
        )
      );
    }

    for (
      const forbidden of [
        ".getDay()",
        ".getHours()",
        ".getMinutes()",
        ".toDateString()",
        "startOfDay(target)",
        "endOfDay(target)",
      ]
    ) {
      assert.equal(
        source.includes(
          forbidden
        ),
        false,
        `staffService.js must not use ${forbidden}`
      );
    }
  }
);
