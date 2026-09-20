import assert from "node:assert/strict";
import test from "node:test";

import {
  normaliseLegacyServiceState,
} from "../../scripts/migrateServiceState.js";

test("legacy service state preserves prior publication and booking semantics", () => {
  assert.deepEqual(
    normaliseLegacyServiceState({
      active: true,
      onlineBookable: false,
    }),
    {
      published: true,
      bookable: false,
    }
  );

  assert.deepEqual(
    normaliseLegacyServiceState({
      active: false,
      onlineBookable: true,
    }),
    {
      published: false,
      bookable: true,
    }
  );
});

test("explicit published and bookable values take precedence over legacy state", () => {
  assert.deepEqual(
    normaliseLegacyServiceState({
      active: false,
      published: true,
      bookable: false,
      onlineBookable: true,
    }),
    {
      published: true,
      bookable: false,
    }
  );
});
