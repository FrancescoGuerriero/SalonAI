import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const catalogueUrl = new URL(
  "../../data/davines-summer-favourites.json",
  import.meta.url
);

async function catalogue() {
  return JSON.parse(
    await readFile(
      catalogueUrl,
      "utf8"
    )
  );
}

test(
  "Davines Summer Favourites catalogue contains 43 unique source products",
  async () => {
    const data =
      await catalogue();

    assert.equal(
      data.products.length,
      43
    );

    assert.equal(
      new Set(
        data.products.map(
          (product) =>
            product.name
              .trim()
              .toLowerCase()
        )
      ).size,
      43
    );

    assert.equal(
      new Set(
        data.products.map(
          (product) =>
            product.internalSku
        )
      ).size,
      43
    );
  }
);

test(
  "Davines catalogue keeps only priced items retail eligible",
  async () => {
    const data =
      await catalogue();

    const retail =
      data.products.filter(
        (product) =>
          product.retailEligible
      );
    const referenceOnly =
      data.products.filter(
        (product) =>
          !product.retailEligible
      );

    assert.equal(
      retail.length,
      39
    );
    assert.equal(
      referenceOnly.length,
      4
    );

    for (
      const product of retail
    ) {
      assert.equal(
        typeof product.referencePrice,
        "number"
      );
      assert.ok(
        product.referencePrice >
          0
      );
      assert.equal(
        product.brand,
        "Davines"
      );
      assert.equal(
        product.collection,
        "Summer Favourites"
      );
    }

    for (
      const product of
      referenceOnly
    ) {
      assert.equal(
        product.referencePrice,
        null
      );
    }
  }
);

test(
  "Davines catalogue records source provenance and GBP pricing",
  async () => {
    const data =
      await catalogue();

    assert.equal(
      data.catalogue.brand,
      "Davines"
    );
    assert.equal(
      data.catalogue.currency,
      "GBP"
    );
    assert.equal(
      data.catalogue.referencePage,
      "https://uk.davines.com/collections/summer-hair-edit"
    );
  }
);
