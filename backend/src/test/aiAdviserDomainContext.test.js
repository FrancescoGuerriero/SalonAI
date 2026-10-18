import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test("legacy Adviser domain context remains aggregate-only but is not activated by the A0 pilot", async () => {
  const contextSource =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserContextService.js",
        import.meta.url
      ),
      "utf8"
    );
  const adviserSource =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    contextSource,
    /countDocuments/
  );
  assert.doesNotMatch(
    adviserSource,
    /buildAdviserDomainContext\(/
  );
  assert.match(
    adviserSource,
    /omittedUnsafeDomains/
  );
});

test("legacy contextual domain selectors are retained as migration evidence for later tenant-safe activation", async () => {
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

test("Business Adviser A0 prompt receives only tenant-safe Appointment aggregate evidence", async () => {
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
    /buildManagementCopilotPayload/
  );
  assert.match(
    source,
    /authorised tenant-scoped evidence/
  );
  assert.match(
    source,
    /Only tenant-safe canonical Appointment aggregates are enabled in this A0 pilot/
  );
  assert.doesNotMatch(
    source,
    /contextualDomainEvidence/
  );
  assert.doesNotMatch(
    source,
    /domainContext/
  );
});

test("no-show model evidence in legacy domain context is not exposed through A0 until tenant-safe activation", async () => {
  const contextSource =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserContextService.js",
        import.meta.url
      ),
      "utf8"
    );
  const adviserSource =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    contextSource,
    /latestNoShowModelEvidence/
  );
  assert.match(
    contextSource,
    /modelEvidence/
  );
  assert.doesNotMatch(
    adviserSource,
    /latestNoShowModelEvidence/
  );
  assert.match(
    adviserSource,
    /knowledge-retrieval/
  );
});
