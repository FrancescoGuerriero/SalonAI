import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import mongoose from "mongoose";

import connectDB from "../src/config/db.js";
import Product from "../src/features/commerce/Product.js";

const DEFAULT_FILE = path.resolve(
  "data",
  "davines-summer-favourites.json"
);

function parseArguments(values) {
  const options = {
    file: DEFAULT_FILE,
    apply: false,
    updatePrices: false,
  };

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    const value = values[index];

    if (value === "--apply") {
      options.apply = true;
    } else if (
      value === "--update-prices"
    ) {
      options.updatePrices = true;
    } else if (value === "--file") {
      options.file =
        values[index + 1] || "";
      index += 1;
    } else if (
      value.startsWith("--file=")
    ) {
      options.file = value.slice(
        "--file=".length
      );
    } else {
      throw new Error(
        `Unknown argument: ${value}`
      );
    }
  }

  return options;
}

function text(
  value,
  max = 500
) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function longText(
  value,
  max = 15000
) {
  return String(value || "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, max);
}

function slugify(value) {
  return text(value, 180)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

function money(
  value,
  field
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${field} must be a non-negative number.`
    );
  }

  return Number(
    parsed.toFixed(2)
  );
}

function normaliseImages(
  value,
  index
) {
  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `products[${index}].images must be an array.`
    );
  }

  const images = value
    .map((item) =>
      text(item, 1000)
    )
    .filter(Boolean);

  for (const image of images) {
    const valid =
      image.startsWith(
        "/products/davines/"
      ) ||
      /^https:\/\//i.test(image);

    if (!valid) {
      throw new Error(
        `products[${index}].images contains an unsupported image path.`
      );
    }
  }

  return [...new Set(images)];
}

function normaliseProduct(
  product,
  index
) {
  const name = text(
    product?.name,
    150
  );
  const sku = text(
    product?.internalSku,
    80
  ).toUpperCase();
  const brand = text(
    product?.brand,
    120
  );
  const category = text(
    product?.category,
    120
  );
  const collection = text(
    product?.collection,
    120
  );

  if (!name) {
    throw new Error(
      `products[${index}].name is required.`
    );
  }

  if (!sku) {
    throw new Error(
      `products[${index}].internalSku is required.`
    );
  }

  const retailEligible =
    product?.retailEligible === true;

  const referencePrice =
    product?.referencePrice === null ||
    product?.referencePrice ===
      undefined
      ? null
      : money(
          product.referencePrice,
          `products[${index}].referencePrice`
        );

  if (
    retailEligible &&
    referencePrice === null
  ) {
    throw new Error(
      `${name} is retail eligible but has no reference price.`
    );
  }

  return {
    name,
    sku,
    slug:
      `davines-${slugify(name)}`,
    brand: brand || "Davines",
    category:
      category || "Haircare",
    collectionName: collection,
    description: text(
      product?.description,
      3000
    ),
    officialDescription:
      longText(
        product?.officialDescription,
        15000
      ),
    badge: text(
      product?.badge,
      80
    ),
    size: text(
      product?.size,
      80
    ),
    images:
      normaliseImages(
        product?.images,
        index
      ),
    referencePrice,
    referenceAvailability: text(
      product?.referenceAvailability,
      40
    ),
    retailEligible,
    featured:
      product?.featured === true,
  };
}

async function loadCatalogue(
  filePath
) {
  const absolutePath =
    path.resolve(filePath);
  const raw = await readFile(
    absolutePath,
    "utf8"
  );
  const parsed = JSON.parse(raw);

  if (
    !Array.isArray(
      parsed?.products
    ) ||
    parsed.products.length === 0
  ) {
    throw new Error(
      "Catalogue must contain products."
    );
  }

  const names = new Set();
  const skus = new Set();

  const products =
    parsed.products.map(
      (product, index) => {
        const normalised =
          normaliseProduct(
            product,
            index
          );
        const nameKey =
          normalised.name.toLowerCase();

        if (
          names.has(nameKey)
        ) {
          throw new Error(
            `Duplicate product name: ${normalised.name}`
          );
        }

        if (
          skus.has(
            normalised.sku
          )
        ) {
          throw new Error(
            `Duplicate internal SKU: ${normalised.sku}`
          );
        }

        names.add(nameKey);
        skus.add(
          normalised.sku
        );

        return normalised;
      }
    );

  return {
    absolutePath,
    metadata:
      parsed.catalogue || {},
    products,
  };
}

async function upsertProduct(
  product,
  {
    updatePrices,
  }
) {
  const existing =
    await Product.findOne({
      $or: [
        {
          sku: product.sku,
        },
        {
          brand:
            /^Davines$/i,
          name: product.name,
        },
      ],
    });

  const common = {
    name: product.name,
    brand: product.brand,
    category:
      product.category,
    collectionName:
      product.collectionName,
    description:
      product.description,
    officialDescription:
      product.officialDescription,
    badge: product.badge,
    size: product.size,
    images: product.images,
    featured:
      product.featured,
    active: true,
  };

  if (existing) {
    Object.assign(
      existing,
      common
    );

    if (
      updatePrices
    ) {
      existing.price =
        product.referencePrice;
    }

    await existing.save();

    return {
      action: "updated",
      product: existing,
    };
  }

  const created =
    await Product.create({
      ...common,
      sku: product.sku,
      slug: product.slug,
      price:
        product.referencePrice,
      stockQuantity: 0,
      reorderLevel: 5,
    });

  return {
    action: "created",
    product: created,
  };
}

const options =
  parseArguments(
    process.argv.slice(2)
  );

try {
  const catalogue =
    await loadCatalogue(
      options.file
    );

  const retail =
    catalogue.products.filter(
      (product) =>
        product.retailEligible
    );
  const referenceOnly =
    catalogue.products.filter(
      (product) =>
        !product.retailEligible
    );
  const withImages =
    retail.filter(
      (product) =>
        product.images.length > 0
    );
  const withOfficialText =
    retail.filter(
      (product) =>
        Boolean(
          product.officialDescription
        )
    );

  console.log(
    `Catalogue: ${catalogue.absolutePath}`
  );
  console.log(
    `Source products: ${catalogue.products.length}`
  );
  console.log(
    `Retail eligible: ${retail.length}`
  );
  console.log(
    `Reference only: ${referenceOnly.length}`
  );
  console.log(
    `Retail products with images: ${withImages.length}/${retail.length}`
  );
  console.log(
    `Retail products with official text: ${withOfficialText.length}/${retail.length}`
  );

  for (
    const product of
    referenceOnly
  ) {
    console.log(
      `[SKIP] ${product.name} (${product.referenceAvailability || "no retail price"})`
    );
  }

  if (!options.apply) {
    console.log(
      "Catalogue validation passed; no database changes were made."
    );
    console.log(
      "Run again with --apply to upsert retail-eligible products."
    );
  } else {
    await connectDB();

    let created = 0;
    let updated = 0;

    for (
      const product of retail
    ) {
      const result =
        await upsertProduct(
          product,
          {
            updatePrices:
              options.updatePrices,
          }
        );

      if (
        result.action ===
        "created"
      ) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    console.log(
      `[PASS] Davines catalogue upsert complete. Created ${created}; updated ${updated}.`
    );
    console.log(
      "New products default to stockQuantity=0. Existing stock quantities are preserved."
    );

    if (
      !options.updatePrices
    ) {
      console.log(
        "Existing SalonAI retail prices were preserved. Use --update-prices only when you intentionally want to refresh them from the reference catalogue."
      );
    }
  }
} catch (error) {
  console.error(
    `Davines catalogue seed failed: ${error.message}`
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
