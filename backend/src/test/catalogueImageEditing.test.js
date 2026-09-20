import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import Product from "../features/commerce/Product.js";
import Service from "../models/service.js";
import {
  MAX_CATALOGUE_IMAGES,
  normaliseCatalogueImage,
  normaliseCatalogueImages,
} from "../utils/catalogueMedia.js";

const SMALL_IMAGE =
  "data:image/jpeg;base64,aGVsbG8=";

test("catalogue media accepts supported uploads, HTTPS URLs and app-relative paths", () => {
  assert.equal(
    normaliseCatalogueImage(
      SMALL_IMAGE
    ),
    SMALL_IMAGE
  );

  assert.equal(
    normaliseCatalogueImage(
      "https://cdn.example.com/service.jpg"
    ),
    "https://cdn.example.com/service.jpg"
  );

  assert.equal(
    normaliseCatalogueImage(
      "/services/cut image.jpg"
    ),
    "/services/cut%20image.jpg"
  );
});

test("catalogue media rejects insecure and protocol-relative image URLs", () => {
  assert.throws(
    () =>
      normaliseCatalogueImage(
        "http://cdn.example.com/image.jpg"
      ),
    (error) =>
      error.statusCode === 400
  );

  assert.throws(
    () =>
      normaliseCatalogueImage(
        "//evil.example/image.jpg"
      ),
    (error) =>
      error.statusCode === 400
  );

  assert.throws(
    () =>
      normaliseCatalogueImage(
        "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA=="
      ),
    (error) =>
      error.statusCode === 400
  );
});

test("product image normalisation de-duplicates images and enforces the production cap", () => {
  assert.deepEqual(
    normaliseCatalogueImages([
      "/products/a.jpg",
      "/products/b.jpg",
      "/products/a.jpg",
    ]),
    [
      "/products/a.jpg",
      "/products/b.jpg",
    ]
  );

  assert.throws(
    () =>
      normaliseCatalogueImages(
        Array.from(
          {
            length:
              MAX_CATALOGUE_IMAGES +
              1,
          },
          (_, index) =>
            `/products/${index}.jpg`
        )
      ),
    (error) =>
      error.statusCode === 400
  );
});

test("service model accepts supported catalogue image data and rejects unsafe URLs", () => {
  const valid =
    new Service({
      name: "Cut",
      category: "Hair",
      price: 50,
      duration: 60,
      image: SMALL_IMAGE,
    });

  assert.equal(
    valid.validateSync(),
    undefined
  );

  const invalid =
    new Service({
      name: "Cut",
      category: "Hair",
      price: 50,
      duration: 60,
      image:
        "http://cdn.example.com/cut.jpg",
    });

  assert.ok(
    invalid.validateSync()
      ?.errors?.image
  );
});

test("product model preserves primary-image order and rejects more than six images", () => {
  const valid =
    new Product({
      name: "Shampoo",
      slug: "shampoo",
      sku: "SHAMPOO-1",
      price: 20,
      images: [
        "/products/primary.jpg",
        SMALL_IMAGE,
      ],
    });

  assert.equal(
    valid.validateSync(),
    undefined
  );

  assert.deepEqual(
    valid.images.map(String),
    [
      "/products/primary.jpg",
      SMALL_IMAGE,
    ]
  );

  const invalid =
    new Product({
      name: "Conditioner",
      slug: "conditioner",
      sku: "COND-1",
      price: 20,
      images: Array.from(
        {
          length:
            MAX_CATALOGUE_IMAGES +
            1,
        },
        (_, index) =>
          `/products/${index}.jpg`
      ),
    });

  assert.ok(
    invalid.validateSync()
      ?.errors?.images
  );
});

test("service and product editors expose the reusable image picker", async () => {
  const [
    servicePage,
    productPage,
  ] =
    await Promise.all([
      readFile(
        new URL(
          "../../../frontend/src/pages/ServicesPage.jsx",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../../../frontend/src/pages/ProductManagementPage.jsx",
          import.meta.url
        ),
        "utf8"
      ),
    ]);

  assert.match(
    servicePage,
    /CatalogueImagePicker/
  );
  assert.match(
    servicePage,
    /label="Service image"/
  );

  assert.match(
    productPage,
    /CatalogueImagePicker/
  );
  assert.match(
    productPage,
    /label="Product images"/
  );
  assert.match(
    productPage,
    /multiple/
  );
});
