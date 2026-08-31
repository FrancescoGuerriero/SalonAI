import assert
  from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import test
  from "node:test";

import {
  buildBookingConfirmationMessage,
} from "../features/premium/whatsapp/whatsappService.js";

const CONTROLLER_URL =
  new URL(
    "../features/premium/whatsapp/whatsappController.js",
    import.meta.url
  );

test(
  "WhatsApp confirmation renders an absolute instant on the London calendar date",
  () => {
    /*
     * 23:30 UTC on 1 September
     * is 00:30 BST on 2 September.
     *
     * A UTC formatter would incorrectly
     * display 1 September.
     */
    const message =
      buildBookingConfirmationMessage({
        serviceName:
          "Haircut",

        stylistName:
          "Alex",

        appointmentDate:
          new Date(
            "2026-09-01T23:30:00.000Z"
          ),

        appointmentTime:
          "00:30",
      });

    assert.match(
      message,
      /Date: Wed, 2 Sept 2026\./
    );

    assert.match(
      message,
      /Time: 00:30\./
    );
  }
);

test(
  "WhatsApp controller uses salon timezone helpers instead of host-local Date mutation",
  async () => {
    const source =
      await readFile(
        CONTROLLER_URL,
        "utf8"
      );

    for (
      const helper of [
        "combineSalonDateAndTime",
        "salonDateAnchor",
        "toSalonDateKey",
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
        "parseBookingDate",
        ".setHours(",
        ".slice(0, 10)",
      ]
    ) {
      assert.equal(
        source.includes(
          forbidden
        ),
        false,
        `WhatsApp controller must not use ${forbidden}`
      );
    }

    const intentionalAbsoluteDateCount =
      source
        .split(
          "appointmentDate: resources.startsAt"
        )
        .length - 1;

    assert.equal(
      intentionalAbsoluteDateCount,
      1,
      "Exactly one absolute appointmentDate should remain for confirmation rendering."
    );
  }
);
