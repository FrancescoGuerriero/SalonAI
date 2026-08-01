export function positiveInteger(
  value,
  fallback,
  maximum = 100
) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

export function paginationFromQuery(query = {}) {
  const page = positiveInteger(query.page, 1, 100000);
  const limit = positiveInteger(query.limit, 20, 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function paginationResult(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
