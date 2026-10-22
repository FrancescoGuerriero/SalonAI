import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  domainEventDefinition,
} from "../features/integrationPlatform/domainEventCatalogue.js";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("lead and opportunity domain events are registered", () => {
  for (const type of [
    "lead.captured",
    "lead.updated",
    "lead.scored",
    "lead.opportunity_created",
    "lead.converted",
    "opportunity.updated",
  ]) {
    assert.deepEqual(domainEventDefinition(type, "1"), {
      type,
      version: "1",
    });
  }
});

test("lead conversion reuses canonical Customer identity and blocks unsafe tenant collisions", async () => {
  const service = await source("../features/leads/leadService.js");
  assert.match(service, /Customer\.find\(/);
  assert.match(service, /CUSTOMER_IDENTITY_CONFLICT/);
  assert.match(service, /CUSTOMER_TENANT_OWNERSHIP_UNRESOLVED/);
  assert.match(service, /CUSTOMER_IDENTITY_OWNED_BY_ANOTHER_BUSINESS/);
  assert.match(service, /Customer\.create/);
  assert.match(service, /lead\.status = "converted"/);
  assert.match(service, /Opportunity\.updateMany/);
  assert.match(service, /recordDomainEvent/);
});

test("lead capture exposes idempotency, immutable history, scoring and nurture workflow bridge", async () => {
  const lead = await source("../models/Lead.js");
  const timeline = await source("../models/LeadTimelineEvent.js");
  const score = await source("../models/LeadScore.js");
  const service = await source("../features/leads/leadService.js");
  const routes = await source("../features/leads/leadRoutes.js");
  const futureRoutes = await source("../features/futureFeatureRoutes.js");

  assert.match(lead, /idempotencyKey/);
  assert.match(lead, /sourceKey/);
  assert.match(timeline, /append-only/);
  assert.match(score, /immutable snapshots/);
  assert.match(service, /ruleScore/);
  assert.match(service, /setLeadNurture/);
  assert.match(routes, /:leadId\/convert/);
  assert.match(routes, /:leadId\/opportunities/);
  assert.match(futureRoutes, /leadRoutes/);
  assert.match(futureRoutes, /"\/leads"/);
});
