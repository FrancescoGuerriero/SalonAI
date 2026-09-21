import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test(
  "production P0 verifier follows unified employee workforce bucket names",
  async () => {
    const workflow =
      await readFile(
        new URL(
          "../../../.github/workflows/production-p0-verification.yml",
          import.meta.url
        ),
        "utf8"
      );

    const controller =
      await readFile(
        new URL(
          "../controllers/adminUserController.js",
          import.meta.url
        ),
        "utf8"
      );

    for (const name of [
      "signInEnabledRows",
      "signInDisabledRows",
    ]) {
      assert.match(
        controller,
        new RegExp(name)
      );
      assert.match(
        workflow,
        new RegExp(name)
      );
    }

    assert.doesNotMatch(
      workflow,
      /\baccountRows\b/
    );
    assert.doesNotMatch(
      workflow,
      /\bprofileRows\b/
    );
    assert.doesNotMatch(
      workflow,
      /Profile-only workforce rows/
    );
  }
);
