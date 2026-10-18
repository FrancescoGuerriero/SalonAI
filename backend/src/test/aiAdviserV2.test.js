import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test("SalonAI Adviser API is protected by trusted tenant authority and ai:use", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiRecommendationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /const tenantAwareAiChain = \[[\s\S]*?trustedTenantContextMiddleware[\s\S]*?effectiveAuthorityMiddleware[\s\S]*?requirePermissions\([\s\S]*?"ai:use"/
  );
  assert.match(
    routes,
    /"\/adviser\/query"[\s\S]*?\.\.\.tenantAwareAiChain[\s\S]*?askAdviser/
  );
});

test("Adviser A0 is read-only, registered-tool governed and tenant scoped", async () => {
  const service =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    service,
    /getBuiltinAiAgentDefinition/
  );
  assert.match(
    service,
    /requireAiWorkforceTool/
  );
  assert.match(
    service,
    /evaluateAgentToolPolicy/
  );
  assert.match(
    service,
    /requestedAutonomy:[\s\S]*?"A0"/
  );
  assert.match(
    service,
    /buildManagementCopilotPayload/
  );
  assert.match(
    service,
    /AiAgentRun\.create/
  );
  assert.match(
    service,
    /AiInferenceLog\.create/
  );
  assert.match(
    service,
    /readOnly: true/
  );
  assert.match(
    service,
    /suggestedActions:\s*\[\]/
  );

  for (const mutation of [
    "createManagedAppointment",
    "rescheduleAppointment",
    "changeAppointmentStatus",
    "deleteOne(",
  ]) {
    assert.equal(
      service.includes(
        mutation
      ),
      false
    );
  }
});

test("Adviser A0 prompt treats authorised metrics as evidence and blocks action claims", async () => {
  const service =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    service,
    /Answer only from the supplied authorised tenant-scoped evidence/
  );
  assert.match(
    service,
    /Do not infer or invent customers, appointments, revenue, policies, causes or data outside the supplied scope/
  );
  assert.match(
    service,
    /Do not claim that you performed, prepared or approved an action/
  );
  assert.match(
    service,
    /evidenceLimitations/
  );
});

test("Adviser A0 deliberately omits knowledge retrieval until tenant ownership is safe", async () => {
  const service =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.doesNotMatch(
    service,
    /AiKnowledgeDocument\.find/
  );
  assert.doesNotMatch(
    service,
    /buildAdviserDomainContext\(/
  );
  assert.match(
    service,
    /omittedUnsafeDomains/
  );
  assert.match(
    service,
    /knowledge-retrieval/
  );
});

test("management shell exposes contextual Ask SalonAI only through ai:use", async () => {
  const layout =
    await readFile(
      new URL(
        "../../../frontend/src/components/MainLayout.jsx",
        import.meta.url
      ),
      "utf8"
    );
  const adviser =
    await readFile(
      new URL(
        "../../../frontend/src/components/ai/SalonAiAdviser.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    layout,
    /hasPermission\([\s\S]*?"ai:use"/
  );
  assert.match(
    layout,
    /contextPath=[\s\S]*?location\.pathname/
  );
  assert.match(
    adviser,
    /Evidence-grounded, read-only management advice/
  );
  assert.match(
    adviser,
    /askSalonAiAdviser/
  );
});

test("Adviser UI labels offline model evidence without implying production activation", async () => {
  const adviser =
    await readFile(
      new URL(
        "../../../frontend/src/components/ai/SalonAiAdviser.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    adviser,
    /Model evidence/
  );
  assert.match(
    adviser,
    /not active in production/
  );
  assert.match(
    adviser,
    /Rules PR-AUC/
  );
});
