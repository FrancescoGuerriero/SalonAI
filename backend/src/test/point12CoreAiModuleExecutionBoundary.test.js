import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AI Adviser and Stylist Copilot require trusted tenant, effective authority, RBAC and their own commercial allocation", async () => {
  const routes = await readFile(
    new URL("../features/aiRecommendations/aiRecommendationRoutes.js", import.meta.url),
    "utf8"
  );
  assert.match(
    routes,
    /const tenantAwareAiChain = \[\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\(\s*"ai:use"\s*\)/
  );
  assert.match(
    routes,
    /const adviserModuleChain = \[\s*\.\.\.tenantAwareAiChain,\s*requireCommercialModule\("ai-decision-support"\)/
  );
  assert.match(
    routes,
    /const stylistModuleChain = \[\s*\.\.\.tenantAwareAiChain,\s*requireCommercialModule\("ai-stylist-copilot"\)/
  );

  for (const handler of [
    "submitFeedback",
    "getEvaluation",
    "listProposals",
    "createProposal",
    "reviewProposal",
    "prepareProposalDraft",
    "getAiManagementCopilot",
  ]) {
    assert.match(routes, new RegExp(
      "\\.\\.\\.adviserModuleChain,\\s*asyncHandler\\(" + handler + "\\)"
    ));
  }
  assert.match(
    routes,
    /"\/adviser\/query"[\s\S]*?\.\.\.adviserModuleChain,\s*authoriseCoreAiTool\(\{ agentKey: "business-adviser", toolKey: "business\.metrics\.read" \}\),\s*asyncHandler\(askAdviser\)/
  );
  assert.match(
    routes,
    /\.\.\.stylistModuleChain,\s*asyncHandler\(getAiStylistCopilot\)/
  );
  assert.doesNotMatch(routes, /requireCommercialModule\("ai"\)/);
});
