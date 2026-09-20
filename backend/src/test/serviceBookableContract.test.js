import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test("service booking uses the global bookable domain field", async () => {
  const model =
    await source(
      "../models/service.js"
    );
  const controller =
    await source(
      "../controllers/appointmentController.js"
    );
  const management =
    await source(
      "../../../frontend/src/pages/ServicesPage.jsx"
    );
  const card =
    await source(
      "../../../frontend/src/components/customer/ServiceCard.jsx"
    );

  assert.match(
    model,
    /bookable:\s*\{[\s\S]*type:\s*Boolean/
  );
  assert.doesNotMatch(
    model,
    /onlineBookable/
  );

  assert.match(
    controller,
    /service\.bookable\s*===\s*false/
  );
  assert.doesNotMatch(
    controller,
    /service\.onlineBookable/
  );

  assert.match(
    management,
    /bookable:\s*true/
  );
  assert.match(
    management,
    /"bookable",\s*"Bookable"/
  );
  assert.doesNotMatch(
    management,
    /onlineBookable|Online bookable/
  );

  assert.match(
    card,
    /service\.bookable\s*===\s*false/
  );
  assert.doesNotMatch(
    card,
    /service\.onlineBookable/
  );
});

test("bookable migration preserves legacy false values before removing the old field", async () => {
  const migration =
    await source(
      "../../scripts/migrateServiceBookable.js"
    );

  assert.match(
    migration,
    /typeof document\.onlineBookable ===/
  );
  assert.match(
    migration,
    /return document\.onlineBookable/
  );
  assert.match(
    migration,
    /\$unset:\s*\{[\s\S]*onlineBookable/
  );
  assert.match(
    migration,
    /missingBookable/
  );
});
