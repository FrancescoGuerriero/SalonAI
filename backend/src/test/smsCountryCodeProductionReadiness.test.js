import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

import {
  normalisePhoneNumber,
} from "../services/smsDeliveryService.js";

const testDirectory =
  path.dirname(
    fileURLToPath(import.meta.url)
  );

const envExamplePath =
  path.resolve(
    testDirectory,
    "../../.env.example"
  );

function withEnvironment(
  overrides,
  callback
) {
  const previousValues =
    new Map();

  for (
    const [key, value]
    of Object.entries(overrides)
  ) {
    previousValues.set(
      key,
      process.env[key]
    );

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] =
        String(value);
    }
  }

  try {
    return callback();
  } finally {
    for (
      const [key, value]
      of previousValues.entries()
    ) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test(
  "GB production country code normalises to +44",
  () => {
    withEnvironment(
      {
        DEFAULT_PHONE_COUNTRY_CODE:
          "GB",
      },
      () => {
        const config =
          getMessageDeliveryConfig();

        assert.equal(
          config.sms
            .defaultCountryCode,
          "+44"
        );
      }
    );
  }
);

test(
  "UK country aliases normalise local mobile numbers to E.164",
  () => {
    assert.equal(
      normalisePhoneNumber(
        "07700 900123",
        "GB"
      ),
      "+447700900123"
    );

    assert.equal(
      normalisePhoneNumber(
        "07700 900123",
        "UK"
      ),
      "+447700900123"
    );

    assert.equal(
      normalisePhoneNumber(
        "07700 900123",
        "44"
      ),
      "+447700900123"
    );

    assert.equal(
      normalisePhoneNumber(
        "07700 900123",
        "+44"
      ),
      "+447700900123"
    );
  }
);

test(
  ".env.example uses an E.164-compatible default country code",
  () => {
    const envExample =
      fs.readFileSync(
        envExamplePath,
        "utf8"
      );

    const countryCodeLine =
      envExample
        .split(/\r?\n/)
        .map((line) =>
          line.trim()
        )
        .find((line) =>
          line.startsWith(
            "DEFAULT_PHONE_COUNTRY_CODE="
          )
        );

    assert.equal(
      countryCodeLine,
      "DEFAULT_PHONE_COUNTRY_CODE=+44"
    );
  }
);