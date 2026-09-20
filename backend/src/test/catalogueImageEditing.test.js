import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

async function source(
  relativePath
) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test("service editor provides a real image upload and preview control", async () => {
  const page =
    await source(
      "../../../frontend/src/pages/ServicesPage.jsx"
    );

  assert.match(
    page,
    /CatalogueImagePicker/
  );
  assert.match(
    page,
    /label="Service image"/
  );
  assert.match(
    page,
    /form\.image/
  );
});

test("product editor provides multi-image upload and primary-image management", async () => {
  const page =
    await source(
      "../../../frontend/src/pages/ProductManagementPage.jsx"
    );

  assert.match(
    page,
    /CatalogueImagePicker/
  );
  assert.match(
    page,
    /label="Product images"/
  );
  assert.match(
    page,
    /multiple/
  );
  assert.match(
    page,
    /images\.join/
  );
});

test("catalogue image picker supports upload, URL entry, removal and primary selection", async () => {
  const picker =
    await source(
      "../../../frontend/src/components/catalogue/CatalogueImagePicker.jsx"
    );

  for (const pattern of [
    /type="file"/,
    /image\/jpeg,image\/png,image\/webp/,
    /\+ Add image/,
    /Add URL/,
    /Remove/,
    /Set primary/,
    /MAX_DATA_URL_LENGTH/,
    /DEFAULT_MAX_IMAGES/,
  ]) {
    assert.match(
      picker,
      pattern
    );
  }

  assert.match(
    picker,
    /MAX_DATA_URL_LENGTH\s*=\s*280_000/
  );

  assert.match(
    picker,
    /url\.protocol\s*!==\s*"https:"/
  );

  assert.match(
    picker,
    /text\.startsWith\("\/"\)/
  );
});
