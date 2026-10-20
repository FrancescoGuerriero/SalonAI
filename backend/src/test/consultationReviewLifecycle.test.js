import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertConsultationTransition,
} from "../features/consultations/consultationSessionService.js";

const authoritySource = await readFile(
  new URL(
    "../features/consultations/consultationSessionAuthorityService.js",
    import.meta.url
  ),
  "utf8"
);

test("human review may explicitly decline and close an awaiting review", () => {
  assert.equal(
    assertConsultationTransition("awaiting_review", "closed"),
    "closed"
  );
  assert.equal(
    assertConsultationTransition("in_person_required", "closed"),
    "closed"
  );
});

test("reviewer assignment verifies active tenant role consultation-review authority", () => {
  assert.match(
    authoritySource,
    /resolveTenantStaffRole\(membership\.roleKey,[\s\S]*?activeOnly: true/
  );
  assert.match(
    authoritySource,
    /role\.permissions\.includes\("consultation:review"\)/
  );
  assert.match(
    authoritySource,
    /CONSULTATION_REVIEWER_NOT_AUTHORISED/
  );
});
