function integer(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.trunc(number)
    : 0;
}

function indexKeyNames(index = {}) {
  const key =
    index && typeof index.key === "object" && index.key
      ? index.key
      : {};

  return Object.keys(key);
}

export function classifyTenantCoverage({
  total = 0,
  businessScoped = 0,
  locationScoped = 0,
} = {}) {
  const safeTotal = integer(total);
  const safeBusiness = Math.min(integer(businessScoped), safeTotal);
  const safeLocation = Math.min(integer(locationScoped), safeTotal);

  if (safeTotal === 0) {
    return "empty";
  }

  if (safeBusiness === 0) {
    return "unscoped";
  }

  if (safeBusiness < safeTotal) {
    return "partially-business-scoped";
  }

  if (safeLocation === 0) {
    return "business-scoped";
  }

  if (safeLocation < safeTotal) {
    return "business-scoped-partially-location-aware";
  }

  return "business-and-location-scoped";
}

export function summariseCollectionReadiness({
  name,
  total = 0,
  businessScoped = 0,
  locationScoped = 0,
  indexes = [],
} = {}) {
  const safeTotal = integer(total);
  const safeBusiness = Math.min(integer(businessScoped), safeTotal);
  const safeLocation = Math.min(integer(locationScoped), safeTotal);
  const safeIndexes = Array.isArray(indexes) ? indexes : [];

  const uniqueIndexes = safeIndexes
    .filter((index) => index?.unique === true)
    .map((index) => {
      const keys = indexKeyNames(index);

      return Object.freeze({
        name: String(index.name || ""),
        keys: Object.freeze([...keys]),
        includesBusiness: keys.includes("business"),
        includesLocation: keys.includes("location"),
      });
    });

  const globalUniqueCandidates = uniqueIndexes.filter(
    (index) =>
      !index.includesBusiness &&
      index.keys.some((key) => key !== "_id")
  );

  return Object.freeze({
    name: String(name || ""),
    total: safeTotal,
    businessScoped: safeBusiness,
    locationScoped: safeLocation,
    businessCoverage:
      safeTotal === 0 ? 0 : safeBusiness / safeTotal,
    locationCoverage:
      safeTotal === 0 ? 0 : safeLocation / safeTotal,
    classification: classifyTenantCoverage({
      total: safeTotal,
      businessScoped: safeBusiness,
      locationScoped: safeLocation,
    }),
    uniqueIndexes: Object.freeze(uniqueIndexes),
    globalUniqueCandidates: Object.freeze(globalUniqueCandidates),
  });
}

export function summariseDatabaseReadiness(collections = []) {
  const summaries = (Array.isArray(collections) ? collections : [])
    .map((collection) =>
      summariseCollectionReadiness(collection)
    )
    .sort((left, right) =>
      left.name.localeCompare(right.name)
    );

  const totals = summaries.reduce(
    (accumulator, collection) => {
      accumulator.collections += 1;
      accumulator.documents += collection.total;

      if (collection.classification === "unscoped") {
        accumulator.unscopedCollections += 1;
      }

      if (
        collection.classification ===
        "partially-business-scoped"
      ) {
        accumulator.partiallyScopedCollections += 1;
      }

      if (collection.globalUniqueCandidates.length > 0) {
        accumulator.collectionsWithGlobalUniqueCandidates += 1;
      }

      return accumulator;
    },
    {
      collections: 0,
      documents: 0,
      unscopedCollections: 0,
      partiallyScopedCollections: 0,
      collectionsWithGlobalUniqueCandidates: 0,
    }
  );

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    readOnly: true,
    totals: Object.freeze({ ...totals }),
    collections: Object.freeze(summaries),
  });
}
