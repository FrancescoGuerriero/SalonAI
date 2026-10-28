import assert
  from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import test
  from "node:test";

const CORE_URL =
  new URL(
    "../features/appointments/appointmentManagementCore.js",
    import.meta.url
  );

const SERVICE_URL =
  new URL(
    "../features/appointments/appointmentManagementService.js",
    import.meta.url
  );

test(
  "appointment management uses salon timezone semantics",
  async () => {
    const [coreSource, serviceSource] =
      await Promise.all([
        readFile(
          CORE_URL,
          "utf8"
        ),
        readFile(
          SERVICE_URL,
          "utf8"
        ),
      ]);

    for (
      const helper of [
        "combineSalonDateAndTime",
        "formatSalonTime",
        "salonDateAnchor",
        "salonDayBounds",
        "addSalonDays",
      ]
    ) {
      assert.match(
        coreSource,
        new RegExp(
          `\\b${helper}\\b`
        )
      );
    }

    for (
      const helper of [
        "formatSalonTime",
        "salonDateAnchor",
        "salonDayBounds",
      ]
    ) {
      assert.match(
        serviceSource,
        new RegExp(
          `\\b${helper}\\b`
        )
      );
    }

    for (
      const source
      of [coreSource, serviceSource]
    ) {
      for (
        const forbidden of [
          ".setHours(",
          ".getHours()",
          ".getMinutes()",
          "startOfDay(",
          "endOfDay(",
          "addDays(",
        ]
      ) {
        assert.equal(
          source.includes(
            forbidden
          ),
          false,
          `appointment management must not use ${forbidden}`
        );
      }
    }
  }
);
