import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  fileURLToPath,
} from "node:url";

const currentFile =
  fileURLToPath(
    import.meta.url
  );
const currentDirectory =
  path.dirname(
    currentFile
  );
const cataloguePath =
  path.resolve(
    currentDirectory,
    "../../data/demo-stylists.json"
  );

function loadDemoStylists() {
  return JSON.parse(
    fs.readFileSync(
      cataloguePath,
      "utf8"
    )
  );
}

test(
  "demo team catalogue contains exactly five fictional staff profiles",
  () => {
    const stylists =
      loadDemoStylists();

    assert.equal(
      stylists.length,
      5
    );

    const emails =
      new Set(
        stylists.map(
          (stylist) =>
            stylist.email
        )
      );

    assert.equal(
      emails.size,
      5
    );

    for (
      const stylist of
      stylists
    ) {
      assert.match(
        stylist.email,
        /@salonai\.invalid$/
      );
      assert.ok(
        stylist.firstName
      );
      assert.ok(
        stylist.lastName
      );
      assert.ok(
        stylist.jobTitle
      );
      assert.equal(
        stylist.isActive,
        true
      );
      assert.equal(
        stylist.profilePublished,
        true
      );
      assert.ok(
        Array.isArray(
          stylist.specialties
        )
      );
    }
  }
);
