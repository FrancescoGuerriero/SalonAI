import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test("Adviser domain tools are permission-scoped and aggregate-only", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserContextService.js",
        import.meta.url
      ),
      "utf8"
    );

  for (const permission of [
    "appointment:read",
    "customer:read",
    "product:read",
    "inventory:read",
    "service:read",
    "communications:read",
  ]) {
    assert.match(
      source,
      new RegExp(
        `"${permission.replace(":", "\\:")}"`
      )
    );
  }

  assert.match(
    source,
    /countDocuments/
  );

  for (const sensitiveField of [
    "email",
    "phone",
    "hairProfile",
    "internalNotes",
    "consultationNotes",
    "costPrice",
  ]) {
    assert.equal(
      source.includes(
        sensitiveField
      ),
      false
    );
  }
});

test("page path selects contextual AI domains instead of loading all business data", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserContextService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /appointment\|calendar\|booking/
  );
  assert.match(
    source,
    /customer\|crm/
  );
  assert.match(
    source,
    /product\|inventory\|shop/
  );
  assert.match(
    source,
    /communication\|campaign\|marketing/
  );
});

test("Adviser prompt and evidence include permitted domain context", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /buildAdviserDomainContext/
  );
  assert.match(
    source,
    /contextualDomainEvidence/
  );
  assert.match(
    source,
    /domainContext/
  );
});
