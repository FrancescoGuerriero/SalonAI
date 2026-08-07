import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv, stringifyCsv } from "./csv.js";

test("CSV parsing handles BOM, commas, quotes and line breaks", () => {
  const parsed = parseCsv(
    '\uFEFFfirstName,lastName,notes\r\nAnna,Smith,"Colour, cut"\r\nBen,Jones,"Line one\nLine two"'
  );
  assert.deepEqual(parsed.headers, ["firstName", "lastName", "notes"]);
  assert.equal(parsed.rows[0].notes, "Colour, cut");
  assert.equal(parsed.rows[1].notes, "Line one\nLine two");
  assert.equal(parsed.rows[1].__rowNumber, 3);
});

test("CSV parsing rejects duplicate headers and header-only files", () => {
  assert.throws(() => parseCsv("name,name\nOne,Two"), /Duplicate CSV header/);
  assert.throws(() => parseCsv("name,sku\n"), /no data rows/);
});

test("CSV serialisation escapes values without changing the requested columns", () => {
  const output = stringifyCsv(
    [{ name: 'Hydrating "Care"', description: "Soft, glossy hair" }],
    ["name", "description"]
  );
  assert.equal(
    output,
    'name,description\r\n"Hydrating ""Care""","Soft, glossy hair"'
  );
});
