import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("consultation desk records human modification evidence through the existing review contract", async () => {
  const desk = await source(
    "../../../frontend/src/components/consultation/CanonicalConsultationDesk.jsx"
  );
  const form = await source(
    "../../../frontend/src/components/consultation/ConsultationModificationForm.jsx"
  );

  assert.match(desk, /hasPermission\(user,\s*"consultation:review"\)/);
  assert.match(desk, /decision:\s*"modified"/);
  assert.match(desk, /corrections:\s*\[correction\]/);
  assert.match(desk, /ConsultationModificationForm/);

  assert.match(form, /previousValue:/);
  assert.match(form, /correctedValue:/);
  assert.match(form, /reason:/);
  assert.match(form, /does not bypass or rewrite deterministic safety rules/i);
  assert.doesNotMatch(form, /structuredFeatures\s*=/);
});

test("authorised human review panel exposes the canonical decline decision without new authority", async () => {
  const form = await source(
    "../../../frontend/src/components/consultation/ConsultationModificationForm.jsx"
  );
  const service = await source(
    "../../../frontend/src/Services/consultationService.js"
  );

  assert.match(form, /consultationService\.reviewConsultation\(consultationId/);
  assert.match(form, /decision:\s*"declined"/);
  assert.match(form, /Decline consultation/);
  assert.match(service, /\/review/);
  assert.doesNotMatch(form, /structuredFeatures\s*=/);
  assert.doesNotMatch(form, /appointment:create/);
});
