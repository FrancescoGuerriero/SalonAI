import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import AiKnowledgeDocument from "../features/aiPlatform/AiKnowledgeDocument.js";
import {
  buildAiKnowledgeScopeQuery,
  retrieveGroundedAiKnowledge,
} from "../features/aiPlatform/aiKnowledgeRetrievalService.js";
import {
  buildAiGroundingContext,
} from "../features/aiPlatform/aiGroundingContextService.js";
import {
  evaluateAiSuiteResult,
  getAiEvaluationSuite,
} from "../features/aiPlatform/aiEvaluationSuiteRegistry.js";
import {
  listBuiltinAiAgentDefinitions,
} from "../features/aiPlatform/aiWorkforceBuiltinAgents.js";

const BUSINESS_ID = "507f1f77bcf86cd799439011";
const LOCATION_ID = "507f1f77bcf86cd799439012";

function authority(overrides = {}) {
  return {
    businessId: BUSINESS_ID,
    locationId: LOCATION_ID,
    locationAccessMode: "selected",
    allowedLocationIds: [LOCATION_ID],
    permissions: ["customer:read", "service:read"],
    ...overrides,
  };
}

function fakeKnowledgeModel(documents, capture = {}) {
  return {
    find(query) {
      capture.query = query;
      return {
        select(selection) {
          capture.selection = selection;
          return this;
        },
        limit(limit) {
          capture.limit = limit;
          return this;
        },
        async lean() {
          return documents;
        },
      };
    },
  };
}

test("AI knowledge model keeps legacy records unscoped but rejects unsafe scoped records", async () => {
  const legacy = new AiKnowledgeDocument({
    sourceType: "document",
    sourceKey: "legacy-doc",
    title: "Legacy",
    content: "Legacy content",
    searchText: "legacy content",
    version: "1",
  });
  await legacy.validate();
  assert.equal(legacy.knowledgeScope?.mode, undefined);

  const tenantWithoutBusiness = new AiKnowledgeDocument({
    sourceType: "policy",
    sourceKey: "tenant-policy",
    title: "Tenant policy",
    content: "Policy",
    searchText: "policy",
    version: "1",
    knowledgeScope: {
      mode: "tenant",
    },
  });
  await assert.rejects(
    tenantWithoutBusiness.validate(),
    /Tenant AI knowledge requires Business ownership/
  );

  const unapprovedVertical = new AiKnowledgeDocument({
    sourceType: "training_material",
    sourceKey: "retail-domain",
    title: "Retail domain",
    content: "Retail guidance",
    searchText: "retail guidance",
    version: "1",
    knowledgeScope: {
      mode: "vertical",
      verticals: ["retail"],
      governanceBasis: "Approved public domain material.",
      crossTenantUseApproved: false,
    },
  });
  await assert.rejects(
    unapprovedVertical.validate(),
    /explicit cross-tenant use approval/
  );
});

test("AI knowledge scope query includes tenant, vertical and platform evidence but no unscoped fallback", () => {
  const query = buildAiKnowledgeScopeQuery({
    effectiveAuthority: authority(),
    verticalId: "salon",
    now: new Date("2026-10-29T12:00:00.000Z"),
  });

  const serialized = JSON.stringify(query);
  assert.match(serialized, /tenant/);
  assert.match(serialized, new RegExp(BUSINESS_ID));
  assert.match(serialized, new RegExp(LOCATION_ID));
  assert.match(serialized, /vertical/);
  assert.match(serialized, /salon/);
  assert.match(serialized, /platform_global/);
  assert.match(serialized, /crossTenantUseApproved/);
  assert.doesNotMatch(serialized, /legacy-fallback/);
});

test("grounded retrieval ranks tenant evidence and filters permissions, audience and profile", async () => {
  const reviewedAt = new Date("2026-10-20T10:00:00.000Z");
  const documents = [
    {
      _id: new mongoose.Types.ObjectId(),
      sourceType: "policy",
      sourceKey: "stylish:cancellation-policy",
      title: "Cancellation policy",
      content: "Stylish cancellation policy allows changes with sufficient notice.",
      searchText: "cancellation changes notice appointment",
      version: "3",
      knowledgeScope: {
        mode: "tenant",
        profileKeys: ["stylish-ai"],
      },
      audience: ["receptionist"],
      requiredPermissions: ["customer:read"],
      tags: ["cancellation", "appointments"],
      provenance: {
        sourceUri: "https://example.invalid/policy",
        sourceHash: "abc123",
        reviewedAt,
      },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      sourceType: "training_material",
      sourceKey: "salon:general-cancellation",
      title: "Salon cancellation guidance",
      content: "General salon cancellation guidance.",
      searchText: "cancellation guidance",
      version: "1",
      knowledgeScope: {
        mode: "vertical",
        profileKeys: [],
      },
      audience: ["receptionist"],
      requiredPermissions: [],
      tags: ["cancellation"],
      provenance: {
        sourceHash: "def456",
        reviewedAt,
      },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      sourceType: "document",
      sourceKey: "private-admin-only",
      title: "Cancellation internal audit",
      content: "Restricted cancellation audit evidence.",
      searchText: "cancellation audit",
      version: "1",
      knowledgeScope: {
        mode: "tenant",
        profileKeys: ["stylish-ai"],
      },
      audience: ["admin"],
      requiredPermissions: ["feature-control:update"],
      tags: ["cancellation"],
      provenance: {
        sourceHash: "restricted",
        reviewedAt,
      },
    },
  ];

  const capture = {};
  const result = await retrieveGroundedAiKnowledge({
    effectiveAuthority: authority(),
    verticalId: "salon",
    profileKey: "stylish-ai",
    audience: "receptionist",
    query: "What is the cancellation policy?",
    knowledgeModel: fakeKnowledgeModel(documents, capture),
  });

  assert.equal(result.resultCount, 2);
  assert.equal(result.results[0].scopeMode, "tenant");
  assert.equal(result.results[0].sourceKey, "stylish:cancellation-policy");
  assert.equal(result.results[0].citation.version, "3");
  assert.equal(result.safety.crossTenantPrivateDataAllowed, false);
  assert.equal(capture.limit, 120);
});

test("grounding context preserves General -> Vertical -> Tenant evidence layers and citations", async () => {
  const context = await buildAiGroundingContext({
    effectiveAuthority: authority(),
    profileKey: "stylish-ai",
    verticalId: "salon",
    audience: "receptionist",
    query: "Can I change my appointment?",
    retrieval: async () => ({
      resultCount: 3,
      results: [
        {
          scopeMode: "platform_global",
          title: "Platform safety",
          citation: { sourceKey: "global", version: "1", sourceUri: "", sourceHash: "g", reviewedAt: null },
        },
        {
          scopeMode: "vertical",
          title: "Salon domain",
          citation: { sourceKey: "salon", version: "2", sourceUri: "", sourceHash: "v", reviewedAt: null },
        },
        {
          scopeMode: "tenant",
          title: "Stylish policy",
          citation: { sourceKey: "stylish", version: "5", sourceUri: "", sourceHash: "t", reviewedAt: null },
        },
      ],
    }),
  });

  assert.equal(context.layers.general.length, 1);
  assert.equal(context.layers.vertical.length, 1);
  assert.equal(context.layers.tenant.length, 1);
  assert.equal(context.citations.length, 3);
  assert.equal(context.safety.knowledgeMayAuthorizeMutation, false);
  assert.match(context.instructions.join(" "), /Prefer tenant evidence over vertical evidence/);
});

test("grounding context rejects profile and vertical mismatch", async () => {
  await assert.rejects(
    buildAiGroundingContext({
      effectiveAuthority: authority(),
      profileKey: "gut-instinct-ai",
      verticalId: "salon",
      audience: "customer",
      query: "Returns policy",
      retrieval: async () => ({ resultCount: 0, results: [] }),
    }),
    /does not belong to the requested vertical/
  );
});

test("every built-in AI workforce agent resolves to a shared evaluation suite", () => {
  for (const agent of listBuiltinAiAgentDefinitions()) {
    const suite = getAiEvaluationSuite(agent.evaluationSuite?.key);
    assert.ok(suite, `${agent.key} must use a registered evaluation suite`);
    assert.ok(suite.appliesTo.includes(agent.key));
    assert.equal(suite.productionPromotionAuthorized, false);
    assert.equal(suite.automaticPromotionAuthorized, false);

    const taskThreshold = suite.thresholds.taskSuccessRate;
    const policyThreshold = suite.thresholds.policyViolationRate;
    assert.ok(taskThreshold);
    assert.equal(taskThreshold.comparator, ">=");
    assert.ok(taskThreshold.value >= agent.evaluationSuite.minimumTaskSuccessRate);
    assert.ok(policyThreshold);
    assert.equal(policyThreshold.comparator, "<=");
    assert.ok(policyThreshold.value <= agent.evaluationSuite.maximumPolicyViolationRate);
  }
});

test("shared AI evaluation suites fail closed when metrics are missing and never authorize promotion", () => {
  const suite = getAiEvaluationSuite("retail-customer-concierge-draft-v1");
  assert.ok(suite);
  assert.equal(suite.automaticPromotionAuthorized, false);

  const incomplete = evaluateAiSuiteResult({
    suiteKey: suite.key,
    metrics: {
      taskSuccessRate: 0.99,
    },
  });
  assert.equal(incomplete.passed, false);
  assert.ok(incomplete.checks.some((check) => check.reason === "metric-missing"));
  assert.equal(incomplete.productionPromotionAuthorized, false);

  const passing = evaluateAiSuiteResult({
    suiteKey: suite.key,
    metrics: {
      taskSuccessRate: 0.99,
      groundedAnswerRate: 0.99,
      citationCoverageRate: 0.99,
      unsupportedClaimRate: 0,
      policyViolationRate: 0,
      unauthorizedToolUseRate: 0,
    },
  });
  assert.equal(passing.passed, true);
  assert.equal(passing.eligibleForPromotionProposal, true);
  assert.equal(passing.productionPromotionAuthorized, false);
  assert.equal(passing.humanAcceptanceRequired, true);
});
