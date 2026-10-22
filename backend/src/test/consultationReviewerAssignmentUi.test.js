import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("canonical consultation desk exposes permission-gated self assignment through existing authority", async () => {
  const desk = await source(
    "../../../frontend/src/components/consultation/CanonicalConsultationDesk.jsx"
  );
  const service = await source(
    "../../../frontend/src/Services/consultationService.js"
  );

  assert.match(desk, /hasPermission\(user,\s*"consultation:assign"\)/);
  assert.match(desk, /Assign to me/);
  assert.match(desk, /Reassign to me/);
  assert.match(desk, /assignConsultationReviewer\(/);
  assert.match(desk, /idOf\(selected\.review\?\.reviewer\) !== currentUserId/);

  assert.match(
    service,
    /API\.post\(`\$\{BASE\}\/\$\{consultationId\}\/assign`,\s*\{\s*reviewerId,\s*\}\)/
  );
  assert.doesNotMatch(desk, /adminStaffService/);
});
