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

function functionSource(
  sourceText,
  functionName
) {
  const start =
    sourceText.indexOf(
      `export async function ${functionName}`
    );

  assert.ok(
    start >= 0,
    `Missing controller function: ${functionName}`
  );

  const next =
    sourceText.indexOf(
      "\nexport async function ",
      start + 20
    );

  return sourceText.slice(
    start,
    next >= 0
      ? next
      : sourceText.length
  );
}

test("Appointment create keeps transitional Business/Location ownership server-authoritative", async () => {
  const controller =
    await source(
      "../controllers/appointmentController.js"
    );

  const operation =
    functionSource(
      controller,
      "createAppointment"
    );

  assert.doesNotMatch(
    operation,
    /business\s*:\s*body\.business/
  );
  assert.doesNotMatch(
    operation,
    /business\s*:\s*request\.body\.business/
  );
  assert.doesNotMatch(
    operation,
    /location\s*:\s*body\.location/
  );
  assert.doesNotMatch(
    operation,
    /location\s*:\s*request\.body\.location/
  );
  assert.doesNotMatch(
    operation,
    /\.\.\.body/
  );
  assert.doesNotMatch(
    operation,
    /\.\.\.request\.body/
  );
});
