import assert from "node:assert/strict";
import test from "node:test";

import {
  makeCatalogueImagePrimary,
  normaliseCatalogueImageUrl,
  uniqueCatalogueImages,
} from "./catalogueMedia.js";

test("catalogue image URL normalisation accepts HTTPS and app-relative paths", () => {
  assert.equal(
    normaliseCatalogueImageUrl(
      " /products/example image.jpg "
    ),
    "/products/example%20image.jpg"
  );

  assert.equal(
    normaliseCatalogueImageUrl(
      "https://cdn.example.com/image.jpg"
    ),
    "https://cdn.example.com/image.jpg"
  );
});

test("catalogue image URL normalisation rejects protocol-relative and insecure URLs", () => {
  assert.throws(
    () =>
      normaliseCatalogueImageUrl(
        "//evil.example/image.jpg"
      )
  );

  assert.throws(
    () =>
      normaliseCatalogueImageUrl(
        "http://cdn.example.com/image.jpg"
      )
  );
});

test("catalogue image utilities de-duplicate and preserve primary ordering", () => {
  const images =
    uniqueCatalogueImages([
      "/a.jpg",
      "/b.jpg",
      "/a.jpg",
      "",
    ]);

  assert.deepEqual(
    images,
    [
      "/a.jpg",
      "/b.jpg",
    ]
  );

  assert.deepEqual(
    makeCatalogueImagePrimary(
      [
        "/a.jpg",
        "/b.jpg",
        "/c.jpg",
      ],
      2
    ),
    [
      "/c.jpg",
      "/a.jpg",
      "/b.jpg",
    ]
  );
});
