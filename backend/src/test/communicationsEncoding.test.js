import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import {
  fileURLToPath,
} from "node:url";
import test from "node:test";

const specifications = [
  {
    file:
      fileURLToPath(
        new URL(
          "../features/appointments/appointmentNotificationService.js",
          import.meta.url
        )
      ),
    name:
      "appointmentNotificationService.js",
    expectedEscapes: 3,
  },
  {
    file:
      fileURLToPath(
        new URL(
          "../features/appointments/appointmentPaymentNotificationService.js",
          import.meta.url
        )
      ),
    name:
      "appointmentPaymentNotificationService.js",
    expectedEscapes: 2,
  },
  {
    file:
      fileURLToPath(
        new URL(
          "../features/commerce/commerceNotificationService.js",
          import.meta.url
        )
      ),
    name:
      "commerceNotificationService.js",
    expectedEscapes: 6,
  },
];

test(
  "transactional communications use ASCII-safe GBP currency markers",
  async () => {
    const failures = [];

    for (
      const specification
      of specifications
    ) {
      const source =
        await readFile(
          specification.file,
          "utf8"
        );

      const escapedPounds =
        (
          source.match(
            /\\u00A3/g
          ) || []
        ).length;

      const literalPounds =
        (
          source.match(
            /\u00A3/g
          ) || []
        ).length;

      const mojibakeMarkers =
        (
          source.match(
            /[\u00C2\u00C3\u201A]/g
          ) || []
        ).length;

      if (
        escapedPounds !==
        specification.expectedEscapes
      ) {
        failures.push(
          `${specification.name}: expected ${specification.expectedEscapes} ASCII-safe GBP escapes, found ${escapedPounds}`
        );
      }

      if (
        literalPounds !== 0
      ) {
        failures.push(
          `${specification.name}: contains ${literalPounds} literal pound-sign source characters`
        );
      }

      if (
        mojibakeMarkers !== 0
      ) {
        failures.push(
          `${specification.name}: contains ${mojibakeMarkers} mojibake marker characters`
        );
      }
    }

    assert.deepEqual(
      failures,
      []
    );
  }
);
