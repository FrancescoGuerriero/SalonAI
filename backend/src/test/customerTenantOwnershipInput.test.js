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

test("Customer update strips client-supplied Business ownership", async () => {
  const controller =
    await source(
      "../controllers/customerController.js"
    );

  const operation =
    functionSource(
      controller,
      "updateCustomer"
    );

  assert.match(
    operation,
    /delete update\.business;/
  );
});

test("Customer create does not accept Business from the client payload", async () => {
  const controller =
    await source(
      "../controllers/customerController.js"
    );

  const operation =
    functionSource(
      controller,
      "createCustomer"
    );

  assert.doesNotMatch(
    operation,
    /business:\s*req\.body\.business/
  );

  assert.doesNotMatch(
    operation,
    /\.\.\.req\.body/
  );
});
