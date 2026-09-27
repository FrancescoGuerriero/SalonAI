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

test("Service create and update reject client ownership injection by stripping business", async () => {
  const controller =
    await source(
      "../controllers/serviceController.js"
    );

  for (const functionName of [
    "createService",
    "updateService",
  ]) {
    const operation =
      functionSource(
        controller,
        functionName
      );

    assert.match(
      operation,
      /delete payload\.business;/
    );
  }
});

test("Service ownership remains an internal model field rather than a client-managed property", async () => {
  const controller =
    await source(
      "../controllers/serviceController.js"
    );

  const createOperation =
    functionSource(
      controller,
      "createService"
    );
  const updateOperation =
    functionSource(
      controller,
      "updateService"
    );

  assert.doesNotMatch(
    createOperation,
    /business:\s*req\.body\.business/
  );
  assert.doesNotMatch(
    updateOperation,
    /business:\s*req\.body\.business/
  );
});
