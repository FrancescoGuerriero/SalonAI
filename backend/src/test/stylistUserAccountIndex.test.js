import assert from "node:assert/strict";
import test from "node:test";

import Stylist from "../models/Stylist.js";

test(
  "stylist userAccount uniqueness ignores unlinked profiles",
  () => {
    const path =
      Stylist.schema.path(
        "userAccount"
      );

    assert.equal(
      path.options.unique,
      undefined
    );
    assert.equal(
      path.options.sparse,
      undefined
    );
    assert.equal(
      path.options.default,
      undefined
    );

    const matchingIndex =
      Stylist.schema
        .indexes()
        .find(
          ([fields]) =>
            fields.userAccount ===
              1 &&
            Object.keys(
              fields
            ).length === 1
        );

    assert.ok(
      matchingIndex,
      "Expected userAccount index."
    );

    const [, options] =
      matchingIndex;

    assert.equal(
      options.unique,
      true
    );
    assert.deepEqual(
      options.partialFilterExpression,
      {
        userAccount: {
          $type: "objectId",
        },
      }
    );
  }
);
