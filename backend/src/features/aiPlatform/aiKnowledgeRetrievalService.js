import AiKnowledgeDocument from "./AiKnowledgeDocument.js";

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const MAX_CANDIDATES = 120;
const MAX_EXCERPT_CHARS = 1800;

function retrievalError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function idText(value) {
  const candidate = value && typeof value === "object" && "_id" in value
    ? value._id
    : value;
  return text(candidate);
}

function cleanTerms(query) {
  return [
    ...new Set(
      lower(query)
        .split(/[^a-z0-9]+/g)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    ),
  ].slice(0, 16);
}

function boundedLimit(value) {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function effectiveLocationIds(authority = {}) {
  if (authority.locationAccessMode === "all") {
    return null;
  }

  return [
    ...new Set(
      [
        ...(Array.isArray(authority.allowedLocationIds)
          ? authority.allowedLocationIds
          : []),
        authority.locationId,
      ]
        .map(idText)
        .filter(Boolean)
    ),
  ];
}

function tenantScopeClause(authority) {
  const businessId = idText(authority?.businessId);
  if (!businessId) {
    throw retrievalError(
      "Trusted Business authority is required for AI knowledge retrieval.",
      "AI_KNOWLEDGE_BUSINESS_AUTHORITY_REQUIRED",
      403
    );
  }

  const locationIds = effectiveLocationIds(authority);
  const clause = {
    "knowledgeScope.mode": "tenant",
    "knowledgeScope.business": businessId,
  };

  if (locationIds !== null) {
    clause.$or = [
      { "knowledgeScope.locations.0": { $exists: false } },
      { "knowledgeScope.locations": { $in: locationIds } },
    ];
  }

  return clause;
}

function sharedScopeClauses(verticalId) {
  const vertical = lower(verticalId);
  const clauses = [
    {
      "knowledgeScope.mode": "platform_global",
      "knowledgeScope.crossTenantUseApproved": true,
      "knowledgeScope.governanceBasis": { $nin: ["", null] },
    },
  ];

  if (vertical) {
    clauses.push({
      "knowledgeScope.mode": "vertical",
      "knowledgeScope.verticals": vertical,
      "knowledgeScope.crossTenantUseApproved": true,
      "knowledgeScope.governanceBasis": { $nin: ["", null] },
    });
  }

  return clauses;
}

function requiredPermissionsAllowed(document, permissions) {
  const required = Array.isArray(document.requiredPermissions)
    ? document.requiredPermissions.filter(Boolean)
    : [];
  if (required.length === 0) return true;

  const granted = new Set(
    (Array.isArray(permissions) ? permissions : []).map(text).filter(Boolean)
  );
  return required.every((permission) => granted.has(permission));
}

function audienceAllowed(document, audience) {
  const audiences = Array.isArray(document.audience)
    ? document.audience.filter(Boolean)
    : [];
  if (audiences.length === 0) return true;
  const requested = lower(audience);
  return Boolean(requested && audiences.includes(requested));
}

function profileAllowed(document, profileKey) {
  const profileKeys = Array.isArray(document.knowledgeScope?.profileKeys)
    ? document.knowledgeScope.profileKeys.filter(Boolean)
    : [];
  if (profileKeys.length === 0) return true;
  const requested = lower(profileKey);
  return Boolean(requested && profileKeys.includes(requested));
}

function countOccurrences(haystack, needle) {
  if (!haystack || !needle) return 0;
  let count = 0;
  let cursor = 0;
  while (true) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + needle.length;
  }
}

function lexicalScore(document, terms) {
  const title = lower(document.title);
  const searchText = lower(document.searchText);
  const content = lower(document.content);
  const tags = (Array.isArray(document.tags) ? document.tags : [])
    .map(lower)
    .join(" ");

  let score = 0;
  for (const term of terms) {
    score += countOccurrences(title, term) * 5;
    score += countOccurrences(tags, term) * 3;
    score += countOccurrences(searchText, term) * 2;
    score += Math.min(3, countOccurrences(content, term));
  }

  const scopeMode = document.knowledgeScope?.mode;
  if (scopeMode === "tenant") score += 3;
  if (scopeMode === "vertical") score += 2;
  if (scopeMode === "platform_global") score += 1;

  return score;
}

function excerpt(content) {
  const value = text(content);
  return value.length <= MAX_EXCERPT_CHARS
    ? value
    : `${value.slice(0, MAX_EXCERPT_CHARS)}…`;
}

function serializeGroundingDocument(document, score) {
  return Object.freeze({
    id: idText(document._id),
    title: text(document.title),
    sourceType: text(document.sourceType),
    sourceKey: text(document.sourceKey),
    version: text(document.version),
    scopeMode: text(document.knowledgeScope?.mode),
    score,
    excerpt: excerpt(document.content),
    tags: Object.freeze([...(Array.isArray(document.tags) ? document.tags : [])]),
    citation: Object.freeze({
      sourceKey: text(document.sourceKey),
      version: text(document.version),
      sourceUri: text(document.provenance?.sourceUri),
      sourceHash: text(document.provenance?.sourceHash),
      reviewedAt: document.provenance?.reviewedAt || null,
    }),
  });
}

export function buildAiKnowledgeScopeQuery({
  effectiveAuthority,
  verticalId = "",
  now = new Date(),
} = {}) {
  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())) {
    throw retrievalError(
      "AI knowledge retrieval requires a valid evaluation time.",
      "AI_KNOWLEDGE_INVALID_TIME"
    );
  }

  return {
    status: "published",
    "provenance.reviewedAt": { $ne: null },
    $and: [
      {
        $or: [
          { validFrom: null },
          { validFrom: { $lte: instant } },
        ],
      },
      {
        $or: [
          { validUntil: null },
          { validUntil: { $gt: instant } },
        ],
      },
      {
        $or: [
          tenantScopeClause(effectiveAuthority),
          ...sharedScopeClauses(verticalId),
        ],
      },
    ],
  };
}

export async function retrieveGroundedAiKnowledge({
  effectiveAuthority,
  verticalId = "",
  profileKey = "",
  audience = "",
  query,
  limit = DEFAULT_LIMIT,
  now = new Date(),
  knowledgeModel = AiKnowledgeDocument,
} = {}) {
  const terms = cleanTerms(query);
  if (terms.length === 0) {
    throw retrievalError(
      "AI knowledge retrieval requires a meaningful query.",
      "AI_KNOWLEDGE_QUERY_REQUIRED"
    );
  }

  if (!knowledgeModel || typeof knowledgeModel.find !== "function") {
    throw retrievalError(
      "AI knowledge retrieval storage is unavailable.",
      "AI_KNOWLEDGE_STORAGE_UNAVAILABLE",
      500
    );
  }

  const scopeQuery = buildAiKnowledgeScopeQuery({
    effectiveAuthority,
    verticalId,
    now,
  });

  const candidates = await knowledgeModel
    .find(scopeQuery)
    .select(
      "_id sourceType sourceKey title content searchText version knowledgeScope retrieval audience requiredPermissions tags provenance"
    )
    .limit(MAX_CANDIDATES)
    .lean();

  const permissions = effectiveAuthority?.permissions || [];
  const ranked = candidates
    .filter((document) => audienceAllowed(document, audience))
    .filter((document) => requiredPermissionsAllowed(document, permissions))
    .filter((document) => profileAllowed(document, profileKey))
    .map((document) => ({
      document,
      score: lexicalScore(document, terms),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return text(left.document.sourceKey).localeCompare(
        text(right.document.sourceKey)
      );
    })
    .slice(0, boundedLimit(limit));

  return Object.freeze({
    retrievalMode: "lexical-governed-v1",
    queryTerms: Object.freeze(terms),
    businessId: idText(effectiveAuthority?.businessId),
    verticalId: lower(verticalId),
    profileKey: lower(profileKey),
    resultCount: ranked.length,
    results: Object.freeze(
      ranked.map(({ document, score }) =>
        serializeGroundingDocument(document, score)
      )
    ),
    safety: Object.freeze({
      legacyUnscopedKnowledgeExcluded: true,
      publishedOnly: true,
      reviewedOnly: true,
      permissionFiltered: true,
      audienceFiltered: true,
      tenantLocationFiltered: true,
      crossTenantPrivateDataAllowed: false,
      externalActionAuthorized: false,
    }),
  });
}

export default retrieveGroundedAiKnowledge;
