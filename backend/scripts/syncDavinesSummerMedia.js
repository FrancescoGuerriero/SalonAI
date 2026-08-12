import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_REVISION = "R3.4";
const DAVINES_ORIGIN = "https://uk.davines.com";
const COLLECTION_HANDLE = "summer-hair-edit";
const COLLECTION_URL = `${DAVINES_ORIGIN}/collections/${COLLECTION_HANDLE}`;
const COLLECTION_PRODUCTS_URL =
  `${COLLECTION_URL}/products.json?limit=250`;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDirectory, "..");
const projectRoot = path.resolve(backendRoot, "..");
const cataloguePath = path.resolve(
  backendRoot,
  "data",
  "davines-summer-favourites.json"
);
const mediaRoot = path.resolve(
  projectRoot,
  "frontend",
  "public",
  "products",
  "davines"
);

const stagingMediaRoot = path.resolve(
  projectRoot,
  "frontend",
  "public",
  "products",
  "davines.__staging"
);
const catalogueTempPath = `${cataloguePath}.r34.tmp`;

/*
 * Verified official Davines UK product handles for products that are not
 * reliably resolved by the collection products.json feed.
 */
const DIRECT_HANDLES = new Map([
  ["DAV-SUM-009", "minu-shampoo"],
  ["DAV-SUM-040", "we-stand-hair-body-face-butter"],
]);


function isReferenceOnly(product) {
  return product?.retailEligible !== true;
}

function parseArguments(values) {
  const options = {
    dryRun: false,
    primaryOnly: false,
  };

  for (const value of values) {
    if (value === "--dry-run") {
      options.dryRun = true;
    } else if (value === "--primary-only") {
      options.primaryOnly = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return options;
}

function text(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function canonicalName(value) {
  return text(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bcolour\b/g, "color")
    .replace(/\bcoloured\b/g, "colored")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(value) {
  return new Set(
    canonicalName(value)
      .split(" ")
      .filter(Boolean)
  );
}

function similarity(leftValue, rightValue) {
  const left = tokenSet(leftValue);
  const right = tokenSet(rightValue);

  if (!left.size || !right.size) {
    return 0;
  }

  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }

  const union = new Set([...left, ...right]).size;
  const containment = common / Math.min(left.size, right.size);
  const jaccard = common / union;

  return Number(
    (containment * 0.75 + jaccard * 0.25).toFixed(6)
  );
}

function safeSegment(value) {
  return canonicalName(value).replace(/\s+/g, "-") || "product";
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
  };

  return String(value || "")
    .replace(/&#(\d+);/g, (_, digits) =>
      String.fromCodePoint(Number(digits))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&([a-z]+);/gi, (match, name) =>
      Object.prototype.hasOwnProperty.call(
        named,
        name.toLowerCase()
      )
        ? named[name.toLowerCase()]
        : match
    );
}

function htmlToPlainText(value) {
  return decodeEntities(
    String(value || "")
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
      .replace(
        /<\/(?:p|div|section|article|h[1-6]|ul|ol|table|tr)>/gi,
        "\n"
      )
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 15000);
}

function resolveRemoteAssetUrl(value) {
  const raw = text(value);

  if (!raw) {
    throw new Error("Image URL is empty.");
  }

  let resolved;

  try {
    if (raw.startsWith("//")) {
      resolved = new URL(`https:${raw}`);
    } else {
      resolved = new URL(raw, DAVINES_ORIGIN);
    }
  } catch {
    throw new Error(`Invalid image URL: ${raw}`);
  }

  if (!["http:", "https:"].includes(resolved.protocol)) {
    throw new Error(
      `Unsupported image URL protocol: ${resolved.protocol}`
    );
  }

  return resolved.href;
}

function extensionFromUrl(url) {
  try {
    const resolved = resolveRemoteAssetUrl(url);
    const ext = path
      .extname(new URL(resolved).pathname)
      .toLowerCase();

    if (
      [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(
        ext
      )
    ) {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    // The downloader will emit the detailed URL error.
  }

  return ".jpg";
}

function imageUrl(image) {
  if (typeof image === "string") {
    return image;
  }

  return image?.src || image?.url || "";
}

function normalizePrice(value, numericPricesAreCents = false) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  const amount =
    numericPricesAreCents && typeof value === "number"
      ? parsed / 100
      : parsed;

  return Number(amount.toFixed(2));
}

function normalizeProduct(
  raw,
  { numericPricesAreCents = false } = {}
) {
  if (!raw) return null;

  const variants = Array.isArray(raw.variants)
    ? raw.variants.map((variant) => ({
        ...variant,
        price: normalizePrice(
          variant?.price,
          numericPricesAreCents
        ),
      }))
    : [];

  const images = Array.isArray(raw.images)
    ? raw.images.map(imageUrl).filter(Boolean)
    : [];

  const featured = imageUrl(raw.featured_image);

  if (featured && !images.includes(featured)) {
    images.unshift(featured);
  }

  return {
    id: raw.id ?? null,
    title: text(raw.title),
    handle: text(raw.handle),
    body_html: raw.body_html ?? raw.description ?? "",
    images,
    variants,
    available: raw.available,
  };
}

function productPrice(product) {
  const prices = (product?.variants || [])
    .map((variant) => Number(variant?.price))
    .filter(
      (value) => Number.isFinite(value) && value >= 0
    );

  return prices.length
    ? Number(Math.min(...prices).toFixed(2))
    : null;
}

function productAvailability(product) {
  if (typeof product?.available === "boolean") {
    return product.available ? "available" : "unavailable";
  }

  const variants = Array.isArray(product?.variants)
    ? product.variants
    : [];

  if (!variants.length) return "unknown";

  return variants.some(
    (variant) => variant?.available !== false
  )
    ? "available"
    : "unavailable";
}

function productSize(product) {
  const candidates = [];

  for (const variant of product?.variants || []) {
    for (const value of [
      variant?.title,
      variant?.option1,
      variant?.option2,
      variant?.option3,
    ]) {
      const cleaned = text(value);

      if (!cleaned || /^default title$/i.test(cleaned)) {
        continue;
      }

      if (
        /\b\d+(?:\.\d+)?\s*(?:ml|l|g|kg|oz|fl\.?\s*oz|pcs?|pieces?)\b/i.test(
          cleaned
        )
      ) {
        candidates.push(cleaned);
      }
    }
  }

  return [...new Set(candidates)].join(" / ").slice(0, 80);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "SalonAI-Davines-Media-Sync/3.4",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Official Davines request failed (${response.status}) for ${url}`
    );
  }

  return response.json();
}

async function fetchOptionalJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "SalonAI-Davines-Media-Sync/3.4",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchOptionalHtml(url) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "SalonAI-Davines-Media-Sync/3.4",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function parseTagAttributes(tag) {
  const attributes = new Map();
  const pattern =
    /([:@A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  for (const match of tag.matchAll(pattern)) {
    attributes.set(
      match[1].toLowerCase(),
      decodeEntities(match[2] ?? match[3] ?? "")
    );
  }

  return attributes;
}

function metaValues(html, key, expectedValue) {
  const values = [];

  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseTagAttributes(match[0]);
    const actual = text(attributes.get(key)).toLowerCase();

    if (actual === expectedValue.toLowerCase()) {
      const content = text(attributes.get("content"));
      if (content) values.push(content);
    }
  }

  return values;
}

function collectJsonLdProducts(value, products) {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdProducts(item, products);
    }
    return;
  }

  if (typeof value !== "object") return;

  const types = Array.isArray(value["@type"])
    ? value["@type"]
    : [value["@type"]];

  if (
    types.some(
      (item) =>
        String(item || "").toLowerCase() === "product"
    )
  ) {
    products.push(value);
  }

  if (value["@graph"]) {
    collectJsonLdProducts(value["@graph"], products);
  }
}

function extractJsonLdProducts(html) {
  const products = [];
  const pattern =
    /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of String(html || "").matchAll(pattern)) {
    const raw = match[1].trim();
    if (!raw) continue;

    let parsed = null;

    for (const candidate of [raw, decodeEntities(raw)]) {
      try {
        parsed = JSON.parse(candidate);
        break;
      } catch {
        // Try the next representation.
      }
    }

    if (parsed) {
      collectJsonLdProducts(parsed, products);
    }
  }

  return products;
}

function schemaImageUrls(value) {
  const output = [];

  function visit(item) {
    if (!item) return;

    if (typeof item === "string") {
      output.push(item);
      return;
    }

    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }

    if (typeof item === "object") {
      for (const key of ["url", "contentUrl"]) {
        if (typeof item[key] === "string") {
          output.push(item[key]);
        }
      }
    }
  }

  visit(value);

  return [...new Set(output.map(text).filter(Boolean))];
}

function schemaOfferData(value) {
  const offers = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  const prices = [];
  let available;

  for (const offer of offers) {
    const price = normalizePrice(
      offer?.price ?? offer?.lowPrice
    );

    if (price !== null) {
      prices.push(price);
    }

    const availability = text(offer?.availability).toLowerCase();

    if (availability.includes("instock")) {
      available = true;
    } else if (
      availability.includes("outofstock") ||
      availability.includes("soldout")
    ) {
      available ??= false;
    }
  }

  return {
    price: prices.length ? Math.min(...prices) : null,
    available,
  };
}

function extractMainProductText(html) {
  const source = String(html || "");
  const mainMatch = source.match(
    /<main\b[^>]*>([\s\S]*?)<\/main>/i
  );

  if (!mainMatch) return "";

  return htmlToPlainText(mainMatch[1]).slice(0, 15000);
}

function productFromHtml(html, handle) {
  const jsonLdProducts = extractJsonLdProducts(html);
  const schema =
    jsonLdProducts.find(
      (item) =>
        canonicalName(item?.name).includes(
          canonicalName(handle).replace(/\s+/g, " ")
        )
    ) ||
    jsonLdProducts[0] ||
    null;

  const ogTitle = metaValues(
    html,
    "property",
    "og:title"
  )[0];
  const ogDescription = metaValues(
    html,
    "property",
    "og:description"
  )[0];
  const ogImages = metaValues(
    html,
    "property",
    "og:image"
  );
  const secureImages = metaValues(
    html,
    "property",
    "og:image:secure_url"
  );

  const schemaImages = schemaImageUrls(schema?.image);
  const images = [
    ...new Set([
      ...schemaImages,
      ...ogImages,
      ...secureImages,
    ]),
  ];

  const offer = schemaOfferData(schema?.offers);
  const mainText = extractMainProductText(html);
  const schemaDescription = htmlToPlainText(
    schema?.description || ogDescription || ""
  );

  const bodyText =
    mainText.length >= schemaDescription.length
      ? mainText
      : schemaDescription;

  const title = text(
    schema?.name ||
      ogTitle ||
      handle
        .split("-")
        .map(
          (part) =>
            part.charAt(0).toUpperCase() +
            part.slice(1)
        )
        .join(" ")
  );

  if (!title || (!images.length && !bodyText)) {
    return null;
  }

  return {
    id: schema?.sku || schema?.productID || null,
    title,
    handle,
    body_html: bodyText,
    images,
    variants:
      offer.price === null
        ? []
        : [
            {
              title: "Default Title",
              price: offer.price,
              available: offer.available,
            },
          ],
    available: offer.available,
  };
}

async function fetchProductByHandle(handle) {
  const clean = text(handle);
  if (!clean) return null;

  let apiProduct = null;

  const jsonPayload = await fetchOptionalJson(
    `${DAVINES_ORIGIN}/products/${encodeURIComponent(clean)}.json`
  );

  if (jsonPayload?.product) {
    apiProduct = normalizeProduct(jsonPayload.product);
  } else if (jsonPayload?.title) {
    apiProduct = normalizeProduct(jsonPayload);
  }

  if (!apiProduct) {
    const jsPayload = await fetchOptionalJson(
      `${DAVINES_ORIGIN}/products/${encodeURIComponent(clean)}.js`
    );

    if (jsPayload) {
      apiProduct = normalizeProduct(jsPayload, {
        numericPricesAreCents: true,
      });
    }
  }

  const html = await fetchOptionalHtml(
    `${DAVINES_ORIGIN}/products/${encodeURIComponent(clean)}`
  );
  const pageProduct = html
    ? productFromHtml(html, clean)
    : null;

  if (!apiProduct) {
    return pageProduct;
  }

  if (!pageProduct) {
    return apiProduct;
  }

  return {
    ...apiProduct,
    title: pageProduct.title || apiProduct.title,
    handle: clean,
    body_html:
      pageProduct.body_html ||
      apiProduct.body_html,
    images: [
      ...new Set([
        ...(apiProduct.images || []),
        ...(pageProduct.images || []),
      ]),
    ],
    variants:
      apiProduct.variants?.length
        ? apiProduct.variants
        : pageProduct.variants,
    available:
      typeof apiProduct.available === "boolean"
        ? apiProduct.available
        : pageProduct.available,
  };
}

async function predictiveSearch(query) {
  const url =
    `${DAVINES_ORIGIN}/search/suggest.json` +
    `?q=${encodeURIComponent(query)}` +
    "&resources[type]=product" +
    "&resources[limit]=10";

  const payload = await fetchOptionalJson(url);

  return payload?.resources?.results?.products || [];
}

function searchHandle(result) {
  const direct = text(result?.handle);
  if (direct) return direct;

  const match = text(result?.url).match(
    /\/products\/([^/?#]+)/
  );

  return match ? match[1] : "";
}

async function resolveProduct(
  catalogueProduct,
  collectionProducts
) {
  const sku = text(
    catalogueProduct?.internalSku
  ).toUpperCase();

  const directHandle = DIRECT_HANDLES.get(sku);

  if (directHandle) {
    const direct = await fetchProductByHandle(directHandle);

    if (!direct) {
      throw new Error(
        `Direct handle ${directHandle} could not be fetched for ${catalogueProduct.name} (${sku}).`
      );
    }

    return {
      product: direct,
      strategy: `direct-handle:${directHandle}`,
      score: 1,
    };
  }

  const wanted = canonicalName(catalogueProduct?.name);
  const exact = collectionProducts.filter(
    (product) =>
      canonicalName(product?.title) === wanted
  );

  if (exact.length === 1) {
    const handle = text(exact[0]?.handle);
    const direct = handle
      ? await fetchProductByHandle(handle)
      : null;

    return {
      product: direct || exact[0],
      strategy: "collection-exact",
      score: 1,
    };
  }

  if (exact.length > 1) {
    throw new Error(
      `Multiple exact collection products matched ${catalogueProduct.name} (${sku}).`
    );
  }

  const suggestions = await predictiveSearch(
    catalogueProduct?.name
  );

  const candidates = suggestions
    .map((suggestion) => ({
      title: text(suggestion?.title),
      handle: searchHandle(suggestion),
      score: similarity(
        catalogueProduct?.name,
        suggestion?.title
      ),
    }))
    .filter((candidate) => candidate.handle)
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  const second = candidates[1];

  if (
    !best ||
    best.score < 0.78 ||
    (second && best.score - second.score < 0.1)
  ) {
    const diagnostic = candidates
      .slice(0, 5)
      .map(
        (candidate) =>
          `${candidate.title} [${candidate.handle}] score=${candidate.score}`
      )
      .join("; ");

    throw new Error(
      `No unique official product match for ${catalogueProduct.name} (${sku || "no SKU"}). Predictive candidates: ${diagnostic || "none"}`
    );
  }

  const direct = await fetchProductByHandle(best.handle);

  if (!direct) {
    throw new Error(
      `Predictive handle ${best.handle} could not be fetched for ${catalogueProduct.name} (${sku}).`
    );
  }

  return {
    product: direct,
    strategy: `predictive:${best.handle}`,
    score: best.score,
  };
}

function validateUniqueAssignments(assignments) {
  const used = new Map();

  for (const assignment of assignments) {
    const identity =
      text(assignment.product?.handle) ||
      String(assignment.product?.id ?? "");

    if (!identity) {
      throw new Error(
        `Resolved official product for ${assignment.catalogue.name} has no stable identity.`
      );
    }

    if (used.has(identity)) {
      throw new Error(
        `Official product ${assignment.product.title} [${identity}] was assigned to both ${used.get(identity)} and ${assignment.catalogue.name}.`
      );
    }

    used.set(identity, assignment.catalogue.name);
  }
}

async function downloadImage(url, destination) {
  const resolvedUrl = resolveRemoteAssetUrl(url);
  const parsed = new URL(resolvedUrl);

  const allowed =
    /(^|\.)davines\.com$/i.test(parsed.hostname) ||
    /(^|\.)shopify\.com$/i.test(parsed.hostname) ||
    /(^|\.)shopifycdn\.com$/i.test(parsed.hostname);

  if (!allowed) {
    throw new Error(
      `Refusing image host outside Davines/Shopify: ${parsed.hostname}`
    );
  }

  const response = await fetch(resolvedUrl, {
    headers: {
      accept:
        "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      "user-agent": "SalonAI-Davines-Media-Sync/3.4",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Image download failed (${response.status}) for ${resolvedUrl}`
    );
  }

  const contentType = text(
    response.headers.get("content-type")
  );

  if (
    contentType &&
    !contentType.toLowerCase().startsWith("image/")
  ) {
    throw new Error(
      `Expected image content but received ${contentType} for ${resolvedUrl}`
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);

  return bytes.length;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  const catalogue = JSON.parse(
    await readFile(cataloguePath, "utf8")
  );

  if (
    !Array.isArray(catalogue?.products) ||
    catalogue.products.length === 0
  ) {
    throw new Error("Davines catalogue contains no products.");
  }

  console.log(`SalonAI Davines sync revision: ${SCRIPT_REVISION}`);
  console.log(`Official collection: ${COLLECTION_URL}`);
  console.log(`Catalogue file: ${cataloguePath}`);
  console.log(
    `Mode: ${
      options.dryRun
        ? "dry run"
        : options.primaryOnly
          ? "primary image"
          : "all images"
    }`
  );

  const collectionPayload = await fetchJson(
    COLLECTION_PRODUCTS_URL
  );

  const collectionProducts = Array.isArray(
    collectionPayload?.products
  )
    ? collectionPayload.products.map((product) =>
        normalizeProduct(product)
      )
    : [];

  console.log(
    `Collection feed products: ${collectionProducts.length}`
  );
  console.log("");
  console.log("=== PREFLIGHT MATCHING ===");

  const assignments = [];
  let resolvedCount = 0;
  let referenceOnlyCount = 0;

  for (const catalogueProduct of catalogue.products) {
    try {
      const resolved = await resolveProduct(
        catalogueProduct,
        collectionProducts
      );

      assignments.push({
        catalogue: catalogueProduct,
        ...resolved,
        referenceOnlyFallback: false,
      });
      resolvedCount += 1;

      console.log(
        `[MATCH] ${catalogueProduct.name} -> ${resolved.product.title} [${resolved.product.handle}] | ${resolved.strategy} | score=${resolved.score}`
      );
    } catch (error) {
      if (!isReferenceOnly(catalogueProduct)) {
        throw error;
      }

      referenceOnlyCount += 1;

      assignments.push({
        catalogue: catalogueProduct,
        product: null,
        strategy: "reference-only-unresolved",
        score: 0,
        referenceOnlyFallback: true,
      });

      console.log(
        `[REFERENCE] ${catalogueProduct.name} (${catalogueProduct.internalSku}) | ${catalogueProduct.referenceAvailability || "reference-only"} | official product endpoint unavailable; catalogue record retained without blocking retail media sync`
      );
    }
  }

  validateUniqueAssignments(
    assignments.filter(
      (assignment) => !assignment.referenceOnlyFallback
    )
  );

  console.log("");
  console.log(
    "[PASS] Davines catalogue preflight complete."
  );
  console.log(
    `Resolved official products: ${resolvedCount}`
  );
  console.log(
    `Reference-only unresolved: ${referenceOnlyCount}`
  );
  console.log(
    `Accounted for: ${assignments.length}/${catalogue.products.length}`
  );

  if (options.dryRun) return;

  console.log("");
  console.log("=== MEDIA + TEXT SYNC ===");

  await rm(stagingMediaRoot, {
    recursive: true,
    force: true,
  });
  await rm(catalogueTempPath, {
    force: true,
  });
  await mkdir(stagingMediaRoot, {
    recursive: true,
  });

  console.log(
    `Staging media directory: ${stagingMediaRoot}`
  );

  const updatedProducts = [];
  let downloadedImages = 0;
  let downloadedBytes = 0;

  for (const assignment of assignments) {
    const catalogueProduct = assignment.catalogue;

    if (assignment.referenceOnlyFallback) {
      updatedProducts.push({
        ...catalogueProduct,
        officialProductId:
          catalogueProduct.officialProductId ?? null,
        officialHandle:
          text(catalogueProduct.officialHandle),
        officialTitle:
          text(catalogueProduct.officialTitle),
        officialProductUrl:
          text(catalogueProduct.officialProductUrl),
        officialPrice:
          catalogueProduct.officialPrice ?? null,
        officialAvailability:
          text(
            catalogueProduct.officialAvailability ||
              catalogueProduct.referenceAvailability
          ),
        size:
          text(catalogueProduct.size),
        officialDescription:
          text(catalogueProduct.officialDescription),
        images:
          Array.isArray(catalogueProduct.images)
            ? catalogueProduct.images
            : [],
      });

      console.log(
        `[SKIP MEDIA] ${catalogueProduct.name} | reference-only unresolved; existing catalogue metadata retained`
      );
      continue;
    }

    const remote = assignment.product;
    const handle = text(remote?.handle);

    const allImages = (
      Array.isArray(remote?.images)
        ? remote.images
        : []
    ).filter(Boolean);

    const images = options.primaryOnly
      ? allImages.slice(0, 1)
      : allImages;

    const localImages = [];
    const productDirectory = path.resolve(
      stagingMediaRoot,
      safeSegment(handle)
    );

    await mkdir(productDirectory, {
      recursive: true,
    });

    for (
      let index = 0;
      index < images.length;
      index += 1
    ) {
      const source = images[index];
      const ext = extensionFromUrl(source);
      const filename =
        `${String(index + 1).padStart(2, "0")}${ext}`;
      const destination = path.resolve(
        productDirectory,
        filename
      );

      let bytes;

      try {
        bytes = await downloadImage(
          source,
          destination
        );
      } catch (error) {
        throw new Error(
          `Image sync failed for ${catalogueProduct.name} (${catalogueProduct.internalSku}) image ${index + 1}/${images.length}: ${error.message}; source=${text(source)}`
        );
      }

      downloadedImages += 1;
      downloadedBytes += bytes;

      localImages.push(
        `/products/davines/${safeSegment(handle)}/${filename}`
      );
    }

    const officialDescription = htmlToPlainText(
      remote?.body_html
    );

    updatedProducts.push({
      ...catalogueProduct,
      officialProductId: remote?.id ?? null,
      officialHandle: handle,
      officialTitle: text(remote?.title),
      officialProductUrl:
        `${DAVINES_ORIGIN}/products/${handle}`,
      officialPrice: productPrice(remote),
      officialAvailability:
        productAvailability(remote),
      size:
        productSize(remote) ||
        text(catalogueProduct?.size),
      officialDescription,
      images: localImages,
    });

    console.log(
      `[SYNC] ${catalogueProduct.name} | images=${localImages.length} | officialText=${officialDescription.length} chars`
    );
  }

  const output = {
    ...catalogue,
    catalogue: {
      ...(catalogue.catalogue || {}),
      mediaSyncedAt: new Date().toISOString(),
      mediaSource: COLLECTION_URL,
      mediaPolicy:
        "Authorised official Davines UK product text and images.",
      syncRevision: SCRIPT_REVISION,
    },
    products: updatedProducts,
  };

  await writeFile(
    catalogueTempPath,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  await rm(mediaRoot, {
    recursive: true,
    force: true,
  });
  await rename(
    stagingMediaRoot,
    mediaRoot
  );
  await rename(
    catalogueTempPath,
    cataloguePath
  );

  const megabytes =
    downloadedBytes / (1024 * 1024);

  console.log("");
  console.log(
    "[PASS] Davines media/text sync complete."
  );
  console.log(
    `Accounted for: ${updatedProducts.length}/${catalogue.products.length}`
  );
  console.log(
    `Reference-only unresolved: ${referenceOnlyCount}`
  );
  console.log(
    `Images downloaded: ${downloadedImages}`
  );
  console.log(
    `Downloaded: ${megabytes.toFixed(2)} MiB`
  );
  console.log(`Media directory: ${mediaRoot}`);
  console.log(`Updated catalogue: ${cataloguePath}`);
}

main().catch(async (error) => {
  await Promise.allSettled([
    rm(stagingMediaRoot, {
      recursive: true,
      force: true,
    }),
    rm(catalogueTempPath, {
      force: true,
    }),
  ]);

  console.error(
    `Davines media sync failed: ${error.message}`
  );
  console.error(
    "Existing catalogue JSON and active Davines media directory were left unchanged."
  );
  process.exitCode = 1;
});
